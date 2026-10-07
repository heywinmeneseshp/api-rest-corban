import { grupoFincaRepository } from '../../repositories/agricola/grupoFinca.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const grupoFincaService = {
  // Eliminar un grupo lo oculta; sus fincas conservan el vínculo pero dejan de
  // agruparse (ver utils/fincaScope.js) hasta que se restaure el grupo.
  async listGrupos(query) {
    const { page, limit, offset } = getPagination(query);
    const incluirEliminados = query.incluirEliminados === true || query.incluirEliminados === 'true';
    const { rows, count } = await grupoFincaRepository.findAndCountAll({ limit, offset, search: query.search, incluirEliminados });
    const conteo = await grupoFincaRepository.contarFincasPorGrupo(rows.map((g) => g.id));
    const items = rows.map((g) => ({ ...g.toJSON(), totalFincas: conteo.get(g.id) || 0 }));
    return { items, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getGrupoByUuid(uuid) {
    const grupo = await grupoFincaRepository.findByUuid(uuid);
    if (!grupo) throw ApiError.notFound('Grupo de finca no encontrado');
    return grupo;
  },

  async createGrupo(payload, actorId) {
    const existing = await grupoFincaRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un grupo de finca con ese nombre');
    return grupoFincaRepository.create({ nombre: payload.nombre, estado: payload.estado ?? true, createdBy: actorId });
  },

  async updateGrupo(uuid, payload, actorId) {
    const grupo = await this.getGrupoByUuid(uuid);
    if (payload.nombre) {
      const existing = await grupoFincaRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== grupo.id) throw ApiError.conflict('Ya existe un grupo de finca con ese nombre');
    }
    return grupoFincaRepository.update(grupo, { ...payload, updatedBy: actorId });
  },

  async restoreGrupo(uuid, actorId) {
    const grupo = await grupoFincaRepository.findByUuidIncluyendoEliminados(uuid);
    if (!grupo) throw ApiError.notFound('Grupo de finca no encontrado');
    if (!grupo.deletedAt) throw ApiError.badRequest('El grupo de finca no está eliminado');
    const existente = await grupoFincaRepository.findByNombre(grupo.nombre);
    if (existente && existente.id !== grupo.id) {
      throw ApiError.conflict('Ya existe un grupo de finca activo con ese nombre: cámbiale el nombre antes de restaurar este');
    }
    await grupoFincaRepository.restore(grupo);
    grupo.updatedBy = actorId;
    await grupo.save();
    return grupo;
  },

  async deleteGrupo(uuid, actorId) {
    const grupo = await this.getGrupoByUuid(uuid);
    await grupoFincaRepository.softDelete(grupo, actorId);
  },
};

export default grupoFincaService;
