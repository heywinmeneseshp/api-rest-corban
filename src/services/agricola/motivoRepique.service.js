import { motivoRepiqueRepository } from '../../repositories/agricola/motivoRepique.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const motivoRepiqueService = {
  async listMotivos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await motivoRepiqueRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getMotivoByUuid(uuid) {
    const motivo = await motivoRepiqueRepository.findByUuid(uuid);
    if (!motivo) throw ApiError.notFound('Motivo de repique no encontrado');
    return motivo;
  },

  async createMotivo(payload, actorId) {
    const existing = await motivoRepiqueRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un motivo de repique con ese nombre');

    return motivoRepiqueRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateMotivo(uuid, payload, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);

    if (payload.nombre) {
      const existing = await motivoRepiqueRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== motivo.id) {
        throw ApiError.conflict('Ya existe un motivo de repique con ese nombre');
      }
    }

    return motivoRepiqueRepository.update(motivo, { ...payload, updatedBy: actorId });
  },

  async deleteMotivo(uuid, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);
    await motivoRepiqueRepository.softDelete(motivo, actorId);
  },
};

export default motivoRepiqueService;
