import { sequelize } from '../../database/connection.js';
import { ordenMantenimientoRepository } from '../../repositories/inventario/ordenMantenimiento.repository.js';
import { Equipo, PlanMantenimiento, ProgramacionMantenimiento, Almacen, User, Producto, OrdenDetalle, OrdenManoObra, OrdenServicio, MovimientoInventario } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertStockSuficiente } from './stock.helper.js';
import { generarCorrelativo } from '../../utils/correlativo.js';
import { OrdenMantenimiento } from '../../database/associations.js';

async function resolveEquipo(uuid) {
  const e = await Equipo.findOne({ where: { uuid } });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}
async function resolvePlan(uuid) {
  if (!uuid) return null;
  const p = await PlanMantenimiento.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Plan no encontrado');
  return p;
}
async function resolveProgramacion(uuid) {
  if (!uuid) return null;
  const pr = await ProgramacionMantenimiento.findOne({ where: { uuid } });
  if (!pr) throw ApiError.notFound('Programación no encontrada');
  return pr;
}
async function resolveAlmacen(uuid) {
  if (!uuid) return null;
  const a = await Almacen.findOne({ where: { uuid } });
  if (!a) throw ApiError.notFound('Almacén no encontrado');
  return a;
}
async function resolveUser(uuid) {
  if (!uuid) return null;
  const u = await User.findOne({ where: { uuid } });
  if (!u) throw ApiError.notFound('Usuario no encontrado');
  return u;
}
async function resolveProducto(uuid) {
  const p = await Producto.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Producto no encontrado');
  return p;
}

async function calcularCostoTotal(detalles, manoObra, servicios) {
  let total = 0;
  if (detalles) {
    for (const d of detalles) {
      const costo = Number(d.costoUnitario || 0) * Number(d.cantidad);
      total += costo;
    }
  }
  if (manoObra) {
    for (const m of manoObra) {
      const ct = m.costoTotal !== undefined && m.costoTotal !== null ? Number(m.costoTotal) : Number(m.horas || 0) * Number(m.costoHora || 0);
      total += ct;
    }
  }
  if (servicios) {
    for (const s of servicios) total += Number(s.costo || 0);
  }
  return total;
}

export const ordenMantenimientoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await ordenMantenimientoRepository.findAndCountAll({
      limit,
      offset,
      equipoUuid: query.equipoUuid,
      planUuid: query.planUuid,
      estado: query.estado,
      prioridad: query.prioridad,
      tipo: query.tipo,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const orden = await ordenMantenimientoRepository.findByUuid(uuid);
    if (!orden) throw ApiError.notFound('Orden de mantenimiento no encontrada');
    return orden;
  },

  async create(payload, actorId) {
    const equipo = await resolveEquipo(payload.equipoUuid);
    const plan = await resolvePlan(payload.planUuid);
    const prog = await resolveProgramacion(payload.programacionUuid);
    const almacen = await resolveAlmacen(payload.almacenUuid);
    const responsable = await resolveUser(payload.responsableUuid);

    if (plan && plan.equipoId !== equipo.id) throw ApiError.badRequest('El plan no pertenece al equipo');
    if (prog && prog.equipoId !== equipo.id) throw ApiError.badRequest('La programación no pertenece al equipo');

    const costoTotal = await calcularCostoTotal(payload.detalles, payload.manoObra, payload.servicios);

    return sequelize.transaction(async (t) => {
      const numero = await generarCorrelativo(OrdenMantenimiento, { prefijo: 'OM', transaction: t });
      const orden = await ordenMantenimientoRepository.create(
        {
          numero,
          equipoId: equipo.id,
          planId: plan ? plan.id : null,
          programacionId: prog ? prog.id : null,
          tipo: payload.tipo || 'PREVENTIVO',
          descripcion: payload.descripcion,
          fecha: payload.fecha,
          responsableId: responsable ? responsable.id : null,
          almacenId: almacen ? almacen.id : null,
          estado: payload.estado || 'ABIERTA',
          prioridad: payload.prioridad || 'MEDIA',
          costoTotal,
          observaciones: payload.observaciones || null,
          usuarioId: actorId,
          createdBy: actorId,
        },
        { transaction: t },
      );

      if (payload.detalles && payload.detalles.length) {
        for (const det of payload.detalles) {
          const producto = await resolveProducto(det.productoUuid);
          const almDet = await resolveAlmacen(det.almacenUuid);
          const costoUnit = Number(det.costoUnitario || producto.costoCompra || 0);
          const costoTot = costoUnit * Number(det.cantidad);
          await OrdenDetalle.create(
            {
              ordenId: orden.id,
              productoId: producto.id,
              cantidad: det.cantidad,
              costoUnitario: costoUnit,
              costoTotal: costoTot,
              almacenId: almDet ? almDet.id : almacen ? almacen.id : null,
              observaciones: det.observaciones || null,
            },
            { transaction: t },
          );
        }
      }

      if (payload.manoObra && payload.manoObra.length) {
        for (const mo of payload.manoObra) {
          const resp = await resolveUser(mo.responsableUuid);
          const costoTot = mo.costoTotal !== undefined && mo.costoTotal !== null ? Number(mo.costoTotal) : Number(mo.horas || 0) * Number(mo.costoHora || 0);
          await OrdenManoObra.create(
            {
              ordenId: orden.id,
              descripcion: mo.descripcion,
              horas: mo.horas || 0,
              costoHora: mo.costoHora || 0,
              costoTotal: costoTot,
              responsableId: resp ? resp.id : null,
              observaciones: mo.observaciones || null,
            },
            { transaction: t },
          );
        }
      }

      if (payload.servicios && payload.servicios.length) {
        for (const serv of payload.servicios) {
          await OrdenServicio.create(
            {
              ordenId: orden.id,
              descripcion: serv.descripcion,
              proveedor: serv.proveedor || null,
              costo: serv.costo || 0,
              observaciones: serv.observaciones || null,
            },
            { transaction: t },
          );
        }
      }

      return ordenMantenimientoRepository.findByUuid(orden.uuid);
    });
  },

  async update(uuid, payload, actorId) {
    const orden = await this.getByUuid(uuid);
    if (orden.estado === 'CERRADA') throw ApiError.badRequest('No se puede editar una orden cerrada');

    let equipoId = orden.equipoId;
    if (payload.equipoUuid) {
      const eq = await resolveEquipo(payload.equipoUuid);
      equipoId = eq.id;
    }
    let planId = orden.planId;
    if (payload.planUuid !== undefined) {
      if (!payload.planUuid) planId = null;
      else {
        const p = await resolvePlan(payload.planUuid);
        if (p.equipoId !== equipoId) throw ApiError.badRequest('El plan no pertenece al equipo');
        planId = p.id;
      }
    }
    let progId = orden.programacionId;
    if (payload.programacionUuid !== undefined) {
      if (!payload.programacionUuid) progId = null;
      else {
        const pr = await resolveProgramacion(payload.programacionUuid);
        if (pr.equipoId !== equipoId) throw ApiError.badRequest('La programación no pertenece al equipo');
        progId = pr.id;
      }
    }
    let almacenId = orden.almacenId;
    if (payload.almacenUuid !== undefined) {
      if (!payload.almacenUuid) almacenId = null;
      else {
        const a = await resolveAlmacen(payload.almacenUuid);
        almacenId = a.id;
      }
    }
    let responsableId = orden.responsableId;
    if (payload.responsableUuid !== undefined) {
      if (!payload.responsableUuid) responsableId = null;
      else {
        const u = await resolveUser(payload.responsableUuid);
        responsableId = u.id;
      }
    }

    // Si vienen detalles/manoObra/servicios, recalcular costoTotal
    let costoTotal = Number(orden.costoTotal);
    const shouldRecalc = payload.detalles !== undefined || payload.manoObra !== undefined || payload.servicios !== undefined;
    if (shouldRecalc) {
      costoTotal = await calcularCostoTotal(payload.detalles ?? orden.detalles, payload.manoObra ?? orden.manoObra, payload.servicios ?? orden.servicios);
      // Si payload trae detalles en formato con productoUuid, calcular correcto
      if (payload.detalles) {
        let tot = 0;
        for (const d of payload.detalles) {
          const prod = await resolveProducto(d.productoUuid);
          const cu = Number(d.costoUnitario ?? prod.costoCompra ?? 0);
          tot += cu * Number(d.cantidad);
        }
        // sumar manoObra y servicios si también vienen
        if (payload.manoObra) for (const m of payload.manoObra) tot += m.costoTotal !== undefined && m.costoTotal !== null ? Number(m.costoTotal) : Number(m.horas||0)*Number(m.costoHora||0);
        if (payload.servicios) for (const s of payload.servicios) tot += Number(s.costo||0);
        // si no vienen manoObra/servicios pero orden ya tiene, sumar existentes
        if (!payload.manoObra && orden.manoObra) for (const m of orden.manoObra) tot += Number(m.costoTotal);
        if (!payload.servicios && orden.servicios) for (const s of orden.servicios) tot += Number(s.costo);
        costoTotal = tot;
      }
    }

    return sequelize.transaction(async (t) => {
      const data = {
        equipoId,
        planId,
        programacionId: progId,
        ...(payload.tipo ? { tipo: payload.tipo } : {}),
        ...(payload.descripcion ? { descripcion: payload.descripcion } : {}),
        ...(payload.fecha ? { fecha: payload.fecha } : {}),
        ...(payload.fechaCierre !== undefined ? { fechaCierre: payload.fechaCierre || null } : {}),
        responsableId,
        almacenId,
        ...(payload.estado ? { estado: payload.estado } : {}),
        ...(payload.prioridad ? { prioridad: payload.prioridad } : {}),
        ...(shouldRecalc ? { costoTotal } : {}),
        ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones || null } : {}),
        updatedBy: actorId,
      };
      await ordenMantenimientoRepository.update(orden, data, { transaction: t });

      if (payload.detalles !== undefined) {
        await OrdenDetalle.destroy({ where: { ordenId: orden.id }, transaction: t });
        if (Array.isArray(payload.detalles) && payload.detalles.length) {
          for (const det of payload.detalles) {
            const producto = await resolveProducto(det.productoUuid);
            const almDet = await resolveAlmacen(det.almacenUuid);
            const costoUnit = Number(det.costoUnitario || producto.costoCompra || 0);
            await OrdenDetalle.create(
              {
                ordenId: orden.id,
                productoId: producto.id,
                cantidad: det.cantidad,
                costoUnitario: costoUnit,
                costoTotal: costoUnit * Number(det.cantidad),
                almacenId: almDet ? almDet.id : almacenId,
                observaciones: det.observaciones || null,
              },
              { transaction: t },
            );
          }
        }
      }
      if (payload.manoObra !== undefined) {
        await OrdenManoObra.destroy({ where: { ordenId: orden.id }, transaction: t });
        if (Array.isArray(payload.manoObra) && payload.manoObra.length) {
          for (const mo of payload.manoObra) {
            const resp = await resolveUser(mo.responsableUuid);
            const costoTot = mo.costoTotal !== undefined && mo.costoTotal !== null ? Number(mo.costoTotal) : Number(mo.horas || 0) * Number(mo.costoHora || 0);
            await OrdenManoObra.create(
              {
                ordenId: orden.id,
                descripcion: mo.descripcion,
                horas: mo.horas || 0,
                costoHora: mo.costoHora || 0,
                costoTotal: costoTot,
                responsableId: resp ? resp.id : null,
                observaciones: mo.observaciones || null,
              },
              { transaction: t },
            );
          }
        }
      }
      if (payload.servicios !== undefined) {
        await OrdenServicio.destroy({ where: { ordenId: orden.id }, transaction: t });
        if (Array.isArray(payload.servicios) && payload.servicios.length) {
          for (const serv of payload.servicios) {
            await OrdenServicio.create(
              {
                ordenId: orden.id,
                descripcion: serv.descripcion,
                proveedor: serv.proveedor || null,
                costo: serv.costo || 0,
                observaciones: serv.observaciones || null,
              },
              { transaction: t },
            );
          }
        }
      }

      return ordenMantenimientoRepository.findByUuid(uuid);
    });
  },

  async delete(uuid, actorId) {
    const orden = await this.getByUuid(uuid);
    if (orden.estado === 'CERRADA') throw ApiError.badRequest('No se puede eliminar una orden cerrada');
    await ordenMantenimientoRepository.softDelete(orden, actorId);
  },

  async cerrar(uuid, payload, actorId) {
    const orden = await this.getByUuid(uuid);
    if (orden.estado === 'CERRADA') throw ApiError.badRequest('La orden ya está cerrada');
    if (orden.estado === 'CANCELADA') throw ApiError.badRequest('No se puede cerrar una orden cancelada');

    // Al cerrar orden, genera salida de inventario vía movimientoService
    const almacenParaSalidaUuid = payload.almacenUuid || (orden.almacen ? orden.almacen.uuid : null);

    return sequelize.transaction(async (t) => {
      // Validar stock y generar movimientos de salida para cada detalle de repuesto
      const detalles = await OrdenDetalle.findAll({ where: { ordenId: orden.id }, transaction: t });

      for (const det of detalles) {
        const producto = await Producto.findByPk(det.productoId, { transaction: t });
        const almacenId = det.almacenId || orden.almacenId;
        let almacen = null;
        if (almacenId) {
          almacen = await Almacen.findByPk(almacenId, { transaction: t });
        } else if (almacenParaSalidaUuid) {
          almacen = await Almacen.findOne({ where: { uuid: almacenParaSalidaUuid }, transaction: t });
        }

        if (!almacen) {
          // Si no hay almacén definido, no genera movimiento pero sigue cerrando (log)
          continue;
        }

        // Verificar stock y crear salida usando MovimientoInventario dentro de transacción (via movimientoService pattern)
        const cantidad = Number(det.cantidad);

        // Si la cantidad es 0, skip
        if (cantidad <= 0) continue;

        // El movimientoService.create espera payload con almacenUuid, productoUuid etc
        // Lo hacemos manualmente aquí para mantener transacción: usar MovimientoInventario.create
        await assertStockSuficiente(almacen.id, producto.id, cantidad, {
          transaction: t,
          nombreProducto: producto.nombre,
          nombreAlmacen: almacen.nombre,
        });

        const costoUnit = Number(det.costoUnitario || producto.costoCompra || 0);
        const documento = orden.numero;
        await MovimientoInventario.create(
          {
            documento,
            tipo: 'SALIDA',
            fecha: orden.fechaCierre || new Date().toISOString().slice(0, 10),
            almacenId: almacen.id,
            productoId: producto.id,
            cantidad,
            cantidadBase: cantidad,
            unidadId: producto.unidadMedidaId || null,
            costoUnitario: costoUnit,
            costoTotal: costoUnit * cantidad,
            observaciones: `Salida por orden mantenimiento ${orden.numero} - ${orden.descripcion.slice(0, 80)}`,
            usuarioId: actorId,
          },
          { transaction: t },
        );
      }

      // Actualizar orden a CERRADA
      await orden.update(
        {
          estado: 'CERRADA',
          fechaCierre: new Date().toISOString().slice(0, 10),
          observaciones: payload.observaciones ? `${orden.observaciones || ''}\n${payload.observaciones}`.trim() : orden.observaciones,
          updatedBy: actorId,
        },
        { transaction: t },
      );

      return ordenMantenimientoRepository.findByUuid(uuid);
    });
  },
};

export default ordenMantenimientoService;
