import { Finca } from '../../database/associations.js';
import { zonaRepository } from '../../repositories/agricola/zona.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findFincaByUuidOrFail = async (uuid) => {
  const finca = await Finca.findOne({ where: { uuid } });
  if (!finca) throw ApiError.badRequest('Finca no encontrada');
  return finca;
};

export const zonaService = {
  async listZonas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await zonaRepository.findAndCountAll({ limit, offset, search: query.search });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getZonaByUuid(uuid) {
    const zona = await zonaRepository.findByUuid(uuid);
    if (!zona) throw ApiError.notFound('Zona no encontrada');
    return zona;
  },

  async createZona(payload, actorId) {
    const existing = await zonaRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe una zona con ese nombre');
    return zonaRepository.create({ nombre: payload.nombre, estado: payload.estado ?? true, createdBy: actorId });
  },

  async updateZona(uuid, payload, actorId) {
    const zona = await this.getZonaByUuid(uuid);
    if (payload.nombre) {
      const existing = await zonaRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== zona.id) throw ApiError.conflict('Ya existe una zona con ese nombre');
    }
    return zonaRepository.update(zona, { ...payload, updatedBy: actorId });
  },

  async deleteZona(uuid, actorId) {
    const zona = await this.getZonaByUuid(uuid);
    await zonaRepository.softDelete(zona, actorId);
  },

  async listZonaFincas(uuid) {
    const zona = await this.getZonaByUuid(uuid);
    return zona.fincas || [];
  },

  async assignFinca(uuid, fincaUuid, actorId) {
    const zona = await this.getZonaByUuid(uuid);
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await zonaRepository.assignFinca(zona.id, finca.id, actorId);
  },

  async removeFinca(uuid, fincaUuid) {
    const zona = await this.getZonaByUuid(uuid);
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await zonaRepository.removeFinca(zona.id, finca.id);
  },
};

export default zonaService;
