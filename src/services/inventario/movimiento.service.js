import { sequelize } from '../../database/connection.js';
import { movimientoRepository } from '../../repositories/inventario/movimiento.repository.js';
import { Almacen, Producto, UnidadMedida, Motivo, UnidadConversion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertStockSuficiente, TIPOS_SALIDA } from './stock.helper.js';

// Convierte cantidad a unidad base del producto (usa factor de conversión si unidad distinta)
async function toBaseCantidad(producto, unidadUuid, cantidad) {
  if (!unidadUuid || !producto.unidadMedidaId) return Number(cantidad);
  const unidad = await UnidadMedida.findOne({ where: { uuid: unidadUuid } });
  if (!unidad || unidad.id === producto.unidadMedidaId) return Number(cantidad);

  // Busca conversión directa
  const conv = await UnidadConversion.findOne({
    where: { unidadOrigenId: unidad.id, unidadDestinoId: producto.unidadMedidaId },
  });
  if (!conv) throw ApiError.badRequest(`No hay conversión de ${unidad.codigo} a unidad base del producto`);
  return Number(cantidad) * Number(conv.factor);
}

export const movimientoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await movimientoRepository.findAndCountAll({
      limit,
      offset,
      almacenUuid: query.almacenUuid,
      productoUuid: query.productoUuid,
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
    const producto = await Producto.findOne({ where: { uuid: payload.productoUuid } });
    if (!producto) throw ApiError.notFound('Producto no encontrado');

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

    const cantidadBase = await toBaseCantidad(producto, payload.unidadUuid, payload.cantidad);
    const costoTotal = Number(payload.costoUnitario || 0) * Number(payload.cantidad);

    return sequelize.transaction(async (t) => {
      // Valida stock para salidas (bloqueo de fila dentro de la misma transacción
      // en la que se inserta el movimiento, para que check e insert sean atómicos)
      if (TIPOS_SALIDA.includes(payload.tipo)) {
        await assertStockSuficiente(almacen.id, producto.id, cantidadBase, {
          transaction: t,
          nombreProducto: producto.nombre,
          nombreAlmacen: almacen.nombre,
        });
      }

      return movimientoRepository.create(
        {
          documento: payload.documento,
          tipo: payload.tipo,
          fecha: payload.fecha,
          almacenId: almacen.id,
          productoId: producto.id,
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
    });
  },

  async createTransferencia(payload, actorId) {
    const almacenOrigen = await Almacen.findOne({ where: { uuid: payload.almacenOrigenUuid } });
    const almacenDestino = await Almacen.findOne({ where: { uuid: payload.almacenDestinoUuid } });
    if (!almacenOrigen || !almacenDestino) throw ApiError.notFound('Almacén origen o destino no encontrado');
    if (almacenOrigen.id === almacenDestino.id) throw ApiError.badRequest('Origen y destino no pueden ser el mismo');

    const producto = await Producto.findOne({ where: { uuid: payload.productoUuid } });
    if (!producto) throw ApiError.notFound('Producto no encontrado');

    const cantidadBase = await toBaseCantidad(producto, payload.unidadUuid, payload.cantidad);

    let unidadId = null;
    if (payload.unidadUuid) {
      const uni = await UnidadMedida.findOne({ where: { uuid: payload.unidadUuid } });
      unidadId = uni?.id || null;
    }

    const costoTotal = Number(payload.costoUnitario || 0) * Number(payload.cantidad);

    return sequelize.transaction(async (t) => {
      await assertStockSuficiente(almacenOrigen.id, producto.id, cantidadBase, {
        transaction: t,
        nombreProducto: producto.nombre,
        nombreAlmacen: almacenOrigen.nombre,
      });

      const salida = await movimientoRepository.create(
        {
          documento: payload.documento,
          tipo: 'TRANSFERENCIA_SALIDA',
          fecha: payload.fecha,
          almacenId: almacenOrigen.id,
          productoId: producto.id,
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
          productoId: producto.id,
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

      return { salida, entrada };
    });
  },

  async getExistencias(query) {
    return movimientoRepository.getExistencias({
      almacenUuid: query.almacenUuid,
      productoUuid: query.productoUuid,
    });
  },

  async getKardex(query) {
    if (!query.productoUuid) throw ApiError.badRequest('productoUuid es requerido para kardex');
    return movimientoRepository.getKardex({
      productoUuid: query.productoUuid,
      almacenUuid: query.almacenUuid,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
  },
};

export default movimientoService;
