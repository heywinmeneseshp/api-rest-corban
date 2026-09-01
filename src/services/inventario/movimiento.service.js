import { sequelize } from '../../database/connection.js';
import { movimientoRepository } from '../../repositories/inventario/movimiento.repository.js';
import { Almacen, Articulo, UnidadMedida, Motivo, UnidadConversion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertStockSuficiente, registrarMovimientoEnCache, TIPOS_SALIDA } from './stock.helper.js';

// Convierte cantidad a unidad base del artículo (usa factor de conversión si unidad distinta)
async function toBaseCantidad(articulo, unidadUuid, cantidad) {
  if (!unidadUuid || !articulo.unidadMedidaId) return Number(cantidad);
  const unidad = await UnidadMedida.findOne({ where: { uuid: unidadUuid } });
  if (!unidad || unidad.id === articulo.unidadMedidaId) return Number(cantidad);

  // Busca conversión directa
  const conv = await UnidadConversion.findOne({
    where: { unidadOrigenId: unidad.id, unidadDestinoId: articulo.unidadMedidaId },
  });
  if (!conv) throw ApiError.badRequest(`No hay conversión de ${unidad.codigo} a unidad base del artículo`);
  return Number(cantidad) * Number(conv.factor);
}

export const movimientoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await movimientoRepository.findAndCountAll({
      limit,
      offset,
      almacenUuid: query.almacenUuid,
      articuloUuid: query.articuloUuid,
      tipo: query.tipo,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      documento: query.documento,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const mov = await movimientoRepository.findByUuid(uuid);
    if (!mov) throw ApiError.notFound('Movimiento no encontrado');
    return mov;
  },

  async create(payload, actorId) {
    const almacen = await Almacen.findOne({ where: { uuid: payload.almacenUuid } });
    if (!almacen) throw ApiError.notFound('Almacén no encontrado');
    const articulo = await Articulo.findOne({ where: { uuid: payload.articuloUuid } });
    if (!articulo) throw ApiError.notFound('Artículo no encontrado');

    let unidadId = null;
    if (payload.unidadUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadUuid } });
      if (!uni) throw ApiError.notFound('Unidad no encontrada');
      unidadId = uni.id;
    }

    let motivoId = null;
    if (payload.motivoUuid) {
      const mot = await Motivo.findOne({ where: { uuid: payload.motivoUuid } });
      if (!mot) throw ApiError.notFound('Motivo no encontrado');
      motivoId = mot.id;
      if (mot.requiereObservacion && !payload.observaciones) {
        throw ApiError.badRequest('Este motivo requiere observación');
      }
    }

    // Ajustes requieren motivo
    if ((payload.tipo === 'AJUSTE_ENTRADA' || payload.tipo === 'AJUSTE_SALIDA') && !motivoId) {
      throw ApiError.badRequest('Los ajustes requieren motivo');
    }

    const cantidadBase = await toBaseCantidad(articulo, payload.unidadUuid, payload.cantidad);
    const costoTotal = Number(payload.costoUnitario || 0) * Number(payload.cantidad);

    return sequelize.transaction(async (t) => {
      // Valida stock para salidas (bloqueo de fila dentro de la misma transacción
      // en la que se inserta el movimiento, para que check e insert sean atómicos)
      if (TIPOS_SALIDA.includes(payload.tipo)) {
        await assertStockSuficiente(almacen.id, articulo.id, cantidadBase, {
          transaction: t,
          nombreArticulo: articulo.nombre,
          nombreAlmacen: almacen.nombre,
        });
      }

      const movimiento = await movimientoRepository.create(
        {
          documento: payload.documento,
          tipo: payload.tipo,
          fecha: payload.fecha,
          almacenId: almacen.id,
          articuloId: articulo.id,
          cantidad: payload.cantidad,
          cantidadBase,
          unidadId,
          costoUnitario: payload.costoUnitario || 0,
          costoTotal,
          lote: payload.lote || null,
          fechaVencimiento: payload.fechaVencimiento || null,
          motivoId,
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
        },
        { transaction: t },
      );

      await registrarMovimientoEnCache(almacen.id, articulo.id, payload.tipo, cantidadBase, t);

      return movimiento;
    });
  },

  async createTransferencia(payload, actorId) {
    const almacenOrigen = await Almacen.findOne({ where: { uuid: payload.almacenOrigenUuid } });
    const almacenDestino = await Almacen.findOne({ where: { uuid: payload.almacenDestinoUuid } });
    if (!almacenOrigen || !almacenDestino) throw ApiError.notFound('Almacén origen o destino no encontrado');
    if (almacenOrigen.id === almacenDestino.id) throw ApiError.badRequest('Origen y destino no pueden ser el mismo');

    const articulo = await Articulo.findOne({ where: { uuid: payload.articuloUuid } });
    if (!articulo) throw ApiError.notFound('Artículo no encontrado');

    const cantidadBase = await toBaseCantidad(articulo, payload.unidadUuid, payload.cantidad);

    let unidadId = null;
    if (payload.unidadUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadUuid } });
      unidadId = uni?.id || null;
    }

    const costoTotal = Number(payload.costoUnitario || 0) * Number(payload.cantidad);

    return sequelize.transaction(async (t) => {
      await assertStockSuficiente(almacenOrigen.id, articulo.id, cantidadBase, {
        transaction: t,
        nombreArticulo: articulo.nombre,
        nombreAlmacen: almacenOrigen.nombre,
      });

      const salida = await movimientoRepository.create(
        {
          documento: payload.documento,
          tipo: 'TRANSFERENCIA_SALIDA',
          fecha: payload.fecha,
          almacenId: almacenOrigen.id,
          articuloId: articulo.id,
          cantidad: payload.cantidad,
          cantidadBase,
          unidadId,
          costoUnitario: payload.costoUnitario || 0,
          costoTotal,
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
        },
        { transaction: t },
      );

      const entrada = await movimientoRepository.create(
        {
          documento: payload.documento,
          tipo: 'TRANSFERENCIA_ENTRADA',
          fecha: payload.fecha,
          almacenId: almacenDestino.id,
          articuloId: articulo.id,
          cantidad: payload.cantidad,
          cantidadBase,
          unidadId,
          costoUnitario: payload.costoUnitario || 0,
          costoTotal,
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
          origenMovimientoId: salida.id,
        },
        { transaction: t },
      );

      await registrarMovimientoEnCache(almacenOrigen.id, articulo.id, 'TRANSFERENCIA_SALIDA', cantidadBase, t);
      await registrarMovimientoEnCache(almacenDestino.id, articulo.id, 'TRANSFERENCIA_ENTRADA', cantidadBase, t);

      return { salida, entrada };
    });
  },

  async getExistencias(query) {
    return movimientoRepository.getExistencias({
      almacenUuid: query.almacenUuid,
      articuloUuid: query.articuloUuid,
    });
  },

  async getKardex(query) {
    if (!query.articuloUuid) throw ApiError.badRequest('articuloUuid es requerido para kardex');
    return movimientoRepository.getKardex({
      articuloUuid: query.articuloUuid,
      almacenUuid: query.almacenUuid,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
  },
};

export default movimientoService;
