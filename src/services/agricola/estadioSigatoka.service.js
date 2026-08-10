import { estadioSigatokaRepository } from '../../repositories/agricola/estadioSigatoka.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const estadioSigatokaService = {
  async listEstadios(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await estadioSigatokaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getEstadioByUuid(uuid) {
    const estadio = await estadioSigatokaRepository.findByUuid(uuid);
    if (!estadio) throw ApiError.notFound('Estadio de Sigatoka no encontrado');
    return estadio;
  },

  async createEstadio(payload, actorId) {
    const existing = await estadioSigatokaRepository.findByEstadio(payload.estadio);
    if (existing) throw ApiError.conflict('Ya existe un estadio de Sigatoka con esa denominación');

    return estadioSigatokaRepository.create({
      estadio: payload.estadio,
      valorL3: payload.valorL3 ?? 0,
      valorL4: payload.valorL4 ?? 0,
      valorL5: payload.valorL5 ?? 0,
      orden: payload.orden ?? 0,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateEstadio(uuid, payload, actorId) {
    const estadio = await this.getEstadioByUuid(uuid);

    if (payload.estadio) {
      const existing = await estadioSigatokaRepository.findByEstadio(payload.estadio);
      if (existing && existing.id !== estadio.id) {
        throw ApiError.conflict('Ya existe un estadio de Sigatoka con esa denominación');
      }
    }

    return estadioSigatokaRepository.update(estadio, { ...payload, updatedBy: actorId });
  },

  async deleteEstadio(uuid, actorId) {
    const estadio = await this.getEstadioByUuid(uuid);
    await estadioSigatokaRepository.softDelete(estadio, actorId);
  },
};

export default estadioSigatokaService;
