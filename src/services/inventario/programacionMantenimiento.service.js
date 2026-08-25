import { programacionMantenimientoRepository } from '../../repositories/inventario/programacionMantenimiento.repository.js';
import { PlanMantenimiento, Equipo, User } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

async function resolveEquipo(uuid) {
  if (!uuid) return null;
  const e = await Equipo.findOne({ where: { uuid } });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}
async function resolvePlan(uuid) {
  if (!uuid) return null;
  const p = await PlanMantenimiento.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Plan de mantenimiento no encontrado');
  return p;
}
async function resolveResponsable(uuid) {
  if (!uuid) return null;
  const u = await User.findOne({ where: { uuid } });
  if (!u) throw ApiError.notFound('Responsable no encontrado');
  return u;
}

export const programacionMantenimientoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await programacionMantenimientoRepository.findAndCountAll({
      limit,
      offset,
      equipoUuid: query.equipoUuid,
      planUuid: query.planUuid,
      estado: query.estado,
      prioridad: query.prioridad,
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const prog = await programacionMantenimientoRepository.findByUuid(uuid);
    if (!prog) throw ApiError.notFound('Programación no encontrada');
    return prog;
  },

  async create(payload, actorId) {
    const equipo = await resolveEquipo(payload.equipoUuid);
    if (!equipo) throw ApiError.badRequest('equipoUuid es requerido');
    const plan = await resolvePlan(payload.planUuid);
    // Si plan existe, valida que pertenezca al mismo equipo si equipo también se envía
    if (plan && plan.equipoId !== equipo.id) {
      throw ApiError.badRequest('El plan no pertenece al equipo indicado');
    }
    const responsable = await resolveResponsable(payload.responsableUuid);

    const prog = await programacionMantenimientoRepository.create({
      planId: plan ? plan.id : null,
      equipoId: equipo.id,
      fechaProgramada: payload.fechaProgramada,
      responsableId: responsable ? responsable.id : null,
      estado: payload.estado || 'PENDIENTE',
      prioridad: payload.prioridad || 'MEDIA',
      observaciones: payload.observaciones || null,
      createdBy: actorId,
    });
    return programacionMantenimientoRepository.findByUuid(prog.uuid);
  },

  async update(uuid, payload, actorId) {
    const prog = await this.getByUuid(uuid);

    let equipoId = prog.equipoId;
    if (payload.equipoUuid) {
      const equipo = await resolveEquipo(payload.equipoUuid);
      equipoId = equipo.id;
    }

    let planId = prog.planId;
    if (payload.planUuid !== undefined) {
      if (!payload.planUuid) planId = null;
      else {
        const plan = await resolvePlan(payload.planUuid);
        planId = plan.id;
        // validar pertenencia
        const equipoActualId = payload.equipoUuid ? equipoId : prog.equipoId;
        if (plan.equipoId !== equipoActualId) throw ApiError.badRequest('El plan no pertenece al equipo');
      }
    }

    let responsableId = prog.responsableId;
    if (payload.responsableUuid !== undefined) {
      if (!payload.responsableUuid) responsableId = null;
      else {
        const r = await resolveResponsable(payload.responsableUuid);
        responsableId = r.id;
      }
    }

    const data = {
      planId,
      equipoId,
      ...(payload.fechaProgramada ? { fechaProgramada: payload.fechaProgramada } : {}),
      ...(payload.fechaEjecucion !== undefined ? { fechaEjecucion: payload.fechaEjecucion || null } : {}),
      responsableId,
      ...(payload.estado ? { estado: payload.estado } : {}),
      ...(payload.prioridad ? { prioridad: payload.prioridad } : {}),
      ...(payload.observaciones !== undefined ? { observaciones: payload.observaciones || null } : {}),
      updatedBy: actorId,
    };

    await programacionMantenimientoRepository.update(prog, data);
    return programacionMantenimientoRepository.findByUuid(uuid);
  },

  async delete(uuid, actorId) {
    const prog = await this.getByUuid(uuid);
    await programacionMantenimientoRepository.softDelete(prog, actorId);
  },
};

export default programacionMantenimientoService;
