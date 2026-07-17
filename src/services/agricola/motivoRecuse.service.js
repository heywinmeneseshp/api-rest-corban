import { motivoRecuseRepository } from '../../repositories/agricola/motivoRecuse.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const motivoRecuseService = {
  async listMotivos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await motivoRecuseRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getMotivoByUuid(uuid) {
    const motivo = await motivoRecuseRepository.findByUuid(uuid);
    if (!motivo) throw ApiError.notFound('Motivo de recuse no encontrado');
    return motivo;
  },

  async createMotivo(payload, actorId) {
    const existing = await motivoRecuseRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un motivo de recuse con ese nombre');

    return motivoRecuseRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateMotivo(uuid, payload, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);

    if (payload.nombre) {
      const existing = await motivoRecuseRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== motivo.id) {
        throw ApiError.conflict('Ya existe un motivo de recuse con ese nombre');
      }
    }

    return motivoRecuseRepository.update(motivo, { ...payload, updatedBy: actorId });
  },

  async deleteMotivo(uuid, actorId) {
    const motivo = await this.getMotivoByUuid(uuid);
    await motivoRecuseRepository.softDelete(motivo, actorId);
  },
};

export default motivoRecuseService;
