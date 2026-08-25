import { sequelize } from '../../database/connection.js';
import { elaboracionRepository } from '../../repositories/inventario/elaboracion.repository.js';
import { MezclaVersion, Mezcla, MezclaComponente, Producto, UnidadMedida, Almacen, MovimientoInventario } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { movimientoService } from './movimiento.service.js';
import { getExistencia, assertStockSuficiente } from './stock.helper.js';

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
        { model: Mezcla, as: 'mezcla', include: [{ model: Producto, as: 'productoElaborado' }] },
        { model: MezclaComponente, as: 'componentes', include: [{ model: Producto, as: 'producto' }, { model: UnidadMedida, as: 'unidad' }] },
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
    // Usa el servicio centralizado de movimientos para consultar existencias por almacén/producto,
    // luego dentro de transacción se re-valida con getSaldo para atomicidad.
    for (const comp of version.componentes) {
      const cantidadRequerida = Number(comp.cantidad) * factor;
      const existencias = await movimientoService.getExistencias({
        almacenUuid: almacen.uuid,
        productoUuid: comp.producto.uuid,
      });
      const saldo = existencias.length ? Number(existencias[0].saldo) : await getExistencia(almacen.id, comp.productoId);
      if (saldo < cantidadRequerida) {
        throw ApiError.badRequest(
          `Stock insuficiente para ${comp.producto.nombre}. Disponible: ${saldo}, requerido: ${cantidadRequerida}`,
        );
      }
    }

    const documento = payload.documento || `ELAB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const fecha = payload.fecha;
    const observaciones = payload.observaciones || null;

    // Calcular costos totales
    let costoTotal = 0;
    for (const comp of version.componentes) {
      const cantidadRequerida = Number(comp.cantidad) * factor;
      const costoUnit = Number(comp.costoUnitarioSnapshot || 0);
      costoTotal += costoUnit * cantidadRequerida;
    }
    const costoUnitario = cantidadElaborada ? costoTotal / cantidadElaborada : 0;

    return sequelize.transaction(async (t) => {
      // Re-validar stock dentro de transacción, con bloqueo de fila
      for (const comp of version.componentes) {
        const cantidadRequerida = Number(comp.cantidad) * factor;
        await assertStockSuficiente(almacen.id, comp.productoId, cantidadRequerida, {
          transaction: t,
          nombreProducto: comp.producto.nombre,
          nombreAlmacen: almacen.nombre,
        });
      }

      // Crear movimientos SALIDA para cada componente
      for (const comp of version.componentes) {
        const cantidadRequerida = Number(comp.cantidad) * factor;
        const costoUnit = Number(comp.costoUnitarioSnapshot || 0);
        const costoTot = costoUnit * cantidadRequerida;
        await MovimientoInventario.create(
          {
            documento,
            tipo: 'ELABORACION_SALIDA',
            fecha,
            almacenId: almacen.id,
            productoId: comp.productoId,
            cantidad: cantidadRequerida,
            cantidadBase: cantidadRequerida,
            unidadId: comp.unidadId || null,
            costoUnitario: costoUnit,
            costoTotal: costoTot,
            observaciones: observaciones ? `Elaboración ${mezcla.nombre} - componente ${comp.producto.nombre}` : null,
            usuarioId: actorId,
          },
          { transaction: t },
        );
      }

      // Crear movimiento ENTRADA para producto elaborado
      const productoElaboradoId = mezcla.productoElaboradoId;
      await MovimientoInventario.create(
        {
          documento,
          tipo: 'ELABORACION_ENTRADA',
          fecha,
          almacenId: almacen.id,
          productoId: productoElaboradoId,
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
