import { grupoFincaRepository } from '../../repositories/agricola/grupoFinca.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const grupoFincaService = {
  async listGrupos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await grupoFincaRepository.findAndCountAll({ limit, offset, search: query.search });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
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

  async deleteGrupo(uuid, actorId) {
    const grupo = await this.getGrupoByUuid(uuid);
    await grupoFincaRepository.softDelete(grupo, actorId);
  },
};

export default grupoFincaService;
