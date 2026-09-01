import { planMantenimientoRepository } from '../../repositories/inventario/planMantenimiento.repository.js';
import { Equipo } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

async function resolveEquipo(uuid) {
  const e = await Equipo.findOne({ where: { uuid } });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}

export const planMantenimientoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await planMantenimientoRepository.findAndCountAll({
      limit,
      offset,
      equipoUuid: query.equipoUuid,
      tipo: query.tipo,
      estado: query.estado,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const plan = await planMantenimientoRepository.findByUuid(uuid);
    if (!plan) throw ApiError.notFound('Plan de mantenimiento no encontrado');
    return plan;
  },

  async create(payload, actorId) {
    const equipo = await resolveEquipo(payload.equipoUuid);
    const plan = await planMantenimientoRepository.create({
      equipoId: equipo.id,
      nombre: payload.nombre,
      descripcion: payload.descripcion || null,
      tipo: payload.tipo || 'PREVENTIVO',
      periodicidadValor: payload.periodicidadValor,
      periodicidadUnidad: payload.periodicidadUnidad,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
    return planMantenimientoRepository.findByUuid(plan.uuid);
  },

  async update(uuid, payload, actorId) {
    const plan = await this.getByUuid(uuid);
    let equipoId = plan.equipoId;
    if (payload.equipoUuid) {
      const equipo = await resolveEquipo(payload.equipoUuid);
      equipoId = equipo.id;
    }
    const data = {
      equipoId,
      ...(payload.nombre ? { nombre: payload.nombre } : {}),
      ...(payload.descripcion !== undefined ? { descripcion: payload.descripcion || null } : {}),
      ...(payload.tipo ? { tipo: payload.tipo } : {}),
      ...(payload.periodicidadValor !== undefined ? { periodicidadValor: payload.periodicidadValor } : {}),
      ...(payload.periodicidadUnidad ? { periodicidadUnidad: payload.periodicidadUnidad } : {}),
      ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
      updatedBy: actorId,
    };
    await planMantenimientoRepository.update(plan, data);
    return planMantenimientoRepository.findByUuid(uuid);
  },

  async delete(uuid, actorId) {
    const plan = await this.getByUuid(uuid);
    await planMantenimientoRepository.softDelete(plan, actorId);
  },
};

export default planMantenimientoService;
