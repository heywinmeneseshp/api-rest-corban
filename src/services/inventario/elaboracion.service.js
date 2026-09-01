import { sequelize } from '../../database/connection.js';
import { elaboracionRepository } from '../../repositories/inventario/elaboracion.repository.js';
import { MezclaVersion, Mezcla, MezclaComponente, Articulo, UnidadMedida, Almacen, MovimientoInventario, Elaboracion } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { movimientoService } from './movimiento.service.js';
import { getExistencia, assertStockSuficiente, registrarMovimientoEnCache } from './stock.helper.js';
import { generarCorrelativo } from '../../utils/correlativo.js';

export const elaboracionService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await elaboracionRepository.findAndCountAll({
      limit,
      offset,
      mezclaUuid: query.mezclaUuid,
      mezclaVersionUuid: query.mezclaVersionUuid,
      almacenUuid: query.almacenUuid,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const elab = await elaboracionRepository.findByUuid(uuid);
    if (!elab) throw ApiError.notFound('Elaboración no encontrada');
    return elab;
  },

  async create(payload, actorId) {
    const almacen = await Almacen.findOne({ where: { uuid: payload.almacenUuid } });
    if (!almacen) throw ApiError.notFound('Almacén no encontrado');

    const version = await MezclaVersion.findOne({
      where: { uuid: payload.mezclaVersionUuid },
      include: [
        { model: Mezcla, as: 'mezcla', include: [{ model: Articulo, as: 'articuloElaborado' }] },
        { model: MezclaComponente, as: 'componentes', include: [{ model: Articulo, as: 'articulo' }, { model: UnidadMedida, as: 'unidad' }] },
      ],
    });
    if (!version) throw ApiError.notFound('Versión de mezcla no encontrada');
    if (!version.activa) throw ApiError.badRequest('Solo se puede elaborar con una versión activa');

    const mezcla = version.mezcla;
    if (!mezcla) throw ApiError.notFound('Mezcla no encontrada');

    const cantidadElaborada = Number(payload.cantidadElaborada);
    if (cantidadElaborada <= 0) throw ApiError.badRequest('cantidadElaborada debe ser positiva');

    const rendimiento = Number(mezcla.rendimiento || 1);
    const factor = cantidadElaborada / rendimiento;

    // Validar stock de cada componente vía movimientoService.getExistencias (FASE 3)
    // Usa el servicio centralizado de movimientos para consultar existencias por almacén/artículo,
    // luego dentro de transacción se re-valida con getSaldo para atomicidad.
    for (const comp of version.componentes) {
      const cantidadRequerida = Number(comp.cantidad) * factor;
      const existencias = await movimientoService.getExistencias({
        almacenUuid: almacen.uuid,
        articuloUuid: comp.articulo.uuid,
      });
      const saldo = existencias.length ? Number(existencias[0].saldo) : await getExistencia(almacen.id, comp.articuloId);
      if (saldo < cantidadRequerida) {
        throw ApiError.badRequest(
          `Stock insuficiente para ${comp.articulo.nombre}. Disponible: ${saldo}, requerido: ${cantidadRequerida}`,
        );
      }
    }

    const fecha = payload.fecha;
    const observaciones = payload.observaciones || null;

    // Costo de cada componente al COSTO ACTUAL del insumo (comp.articulo.costoCompra),
    // no el costoUnitarioSnapshot congelado desde que se creó/versionó la
    // mezcla — cada elaboración es un "movimiento" real y debe quedar
    // costeada con el precio vigente al momento de elaborar, guardando ESE
    // valor como histórico en el movimiento/elaboración resultante (que ya
    // no cambia después). El snapshot de mezcla_componentes sigue existiendo
    // como referencia de la receta, pero deja de ser la fuente del costo real.
    let costoTotal = 0;
    for (const comp of version.componentes) {
      const cantidadRequerida = Number(comp.cantidad) * factor;
      const costoUnit = Number(comp.articulo.costoCompra || 0);
      costoTotal += costoUnit * cantidadRequerida;
    }
    const costoUnitario = cantidadElaborada ? costoTotal / cantidadElaborada : 0;

    return sequelize.transaction(async (t) => {
      const documento = payload.documento || (await generarCorrelativo(Elaboracion, { prefijo: 'ELAB', columna: 'documento', transaction: t }));

      // Re-validar stock dentro de transacción, con bloqueo de fila
      for (const comp of version.componentes) {
        const cantidadRequerida = Number(comp.cantidad) * factor;
        await assertStockSuficiente(almacen.id, comp.articuloId, cantidadRequerida, {
          transaction: t,
          nombreArticulo: comp.articulo.nombre,
          nombreAlmacen: almacen.nombre,
        });
      }

      // Crear movimientos SALIDA para cada componente
      for (const comp of version.componentes) {
        const cantidadRequerida = Number(comp.cantidad) * factor;
        const costoUnit = Number(comp.articulo.costoCompra || 0);
        const costoTot = costoUnit * cantidadRequerida;
        await MovimientoInventario.create(
          {
            documento,
            tipo: 'ELABORACION_SALIDA',
            fecha,
            almacenId: almacen.id,
            articuloId: comp.articuloId,
            cantidad: cantidadRequerida,
            cantidadBase: cantidadRequerida,
            unidadId: comp.unidadId || null,
            costoUnitario: costoUnit,
            costoTotal: costoTot,
            observaciones: observaciones ? `Elaboración ${mezcla.nombre} - componente ${comp.articulo.nombre}` : null,
            usuarioId: actorId,
          },
          { transaction: t },
        );
        await registrarMovimientoEnCache(almacen.id, comp.articuloId, 'ELABORACION_SALIDA', cantidadRequerida, t);
      }

      // Crear movimiento ENTRADA para artículo elaborado
      const articuloElaboradoId = mezcla.articuloElaboradoId;
      await MovimientoInventario.create(
        {
          documento,
          tipo: 'ELABORACION_ENTRADA',
          fecha,
          almacenId: almacen.id,
          articuloId: articuloElaboradoId,
          cantidad: cantidadElaborada,
          cantidadBase: cantidadElaborada,
          unidadId: mezcla.unidadRendimientoId || null,
          costoUnitario,
          costoTotal,
          observaciones: observaciones || `Elaboración ${mezcla.nombre}`,
          usuarioId: actorId,
        },
        { transaction: t },
      );
      await registrarMovimientoEnCache(almacen.id, articuloElaboradoId, 'ELABORACION_ENTRADA', cantidadElaborada, t);

      // Crear registro de elaboración
      const elaboracion = await elaboracionRepository.create(
        {
          documento,
          mezclaVersionId: version.id,
          cantidadElaborada,
          almacenId: almacen.id,
          fecha,
          costoTotal,
          costoUnitario,
          usuarioId: actorId,
          observaciones,
        },
        { transaction: t },
      );

      return elaboracionRepository.findByUuid(elaboracion.uuid);
    });
  },
};

export default elaboracionService;
