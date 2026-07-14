import { fincaRepository } from '../../repositories/agricola/finca.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const fincaService = {
  async listFincas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await fincaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getFincaByUuid(uuid) {
    const finca = await fincaRepository.findByUuid(uuid);
    if (!finca) throw ApiError.notFound('Finca no encontrada');
    return finca;
  },

  async createFinca(payload, actorId) {
    const existing = await fincaRepository.findByCodigo(payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe una finca con ese código');

    return fincaRepository.create({
      codigo: payload.codigo,
      nombre: payload.nombre,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateFinca(uuid, payload, actorId) {
    const finca = await this.getFincaByUuid(uuid);

    if (payload.codigo) {
      const existing = await fincaRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== finca.id) {
        throw ApiError.conflict('Ya existe una finca con ese código');
      }
    }

    return fincaRepository.update(finca, { ...payload, updatedBy: actorId });
  },

  async deleteFinca(uuid, actorId) {
    const finca = await this.getFincaByUuid(uuid);
    await fincaRepository.softDelete(finca, actorId);
  },

  async listLotes(uuid, query) {
    const finca = await this.getFincaByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await fincaRepository.findLotesByFincaId(finca.id, { limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },
};

export default fincaService;
