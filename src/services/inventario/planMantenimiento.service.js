import { planMantenimientoRepository } from '../../repositories/inventario/planMantenimiento.repository.js';
import { Equipo, ChecklistPlantilla } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { campoDeUnidad, planConEstado } from './lecturaEquipo.service.js';

async function resolveEquipo(uuid) {
  const e = await Equipo.findOne({ where: { uuid } });
  if (!e) throw ApiError.notFound('Equipo no encontrado');
  return e;
}

// `plantillaUuid`: undefined = no tocar, null/'' = quitar, uuid = asignar.
async function resolvePlantillaId(uuid) {
  if (uuid === undefined) return undefined;
  if (!uuid) return null;
  const p = await ChecklistPlantilla.findOne({ where: { uuid } });
  if (!p) throw ApiError.notFound('Plantilla de checklist no encontrada');
  return p.id;
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
    return { items: rows.map(planConEstado), meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const plan = await planMantenimientoRepository.findByUuid(uuid);
    if (!plan) throw ApiError.notFound('Plan de mantenimiento no encontrado');
    return plan;
  },

  // Igual que getByUuid pero con el estado de lectura (km / horas) para responder a la web.
  async getConEstado(uuid) {
    return planConEstado(await this.getByUuid(uuid));
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
      plantillaId: (await resolvePlantillaId(payload.plantillaUuid)) ?? null,
      // Planes por km / horas: desde dónde se cuenta (lo escrito, o la lectura actual del equipo).
      lecturaBase: campoDeUnidad(payload.periodicidadUnidad) ? payload.lecturaBase ?? Number(equipo[campoDeUnidad(payload.periodicidadUnidad)] ?? 0) : null,
      createdBy: actorId,
    });
    return planConEstado(await planMantenimientoRepository.findByUuid(plan.uuid));
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
      ...(payload.lecturaBase !== undefined ? { lecturaBase: payload.lecturaBase, avisoEstado: null } : {}),
      ...(payload.plantillaUuid !== undefined ? { plantillaId: await resolvePlantillaId(payload.plantillaUuid) } : {}),
      updatedBy: actorId,
    };
    // Si el plan pasa a km / horas sin base, se cuenta desde la lectura actual del equipo.
    const unidadFinal = payload.periodicidadUnidad || plan.periodicidadUnidad;
    if (campoDeUnidad(unidadFinal) && payload.lecturaBase === undefined && (plan.lecturaBase === null || plan.lecturaBase === undefined)) {
      const eq = payload.equipoUuid ? await resolveEquipo(payload.equipoUuid) : await Equipo.findByPk(plan.equipoId);
      data.lecturaBase = Number(eq?.[campoDeUnidad(unidadFinal)] ?? 0);
    }
    await planMantenimientoRepository.update(plan, data);
    return planConEstado(await planMantenimientoRepository.findByUuid(uuid));
  },

  async delete(uuid, actorId) {
    const plan = await this.getByUuid(uuid);
    await planMantenimientoRepository.softDelete(plan, actorId);
  },
};

export default planMantenimientoService;
