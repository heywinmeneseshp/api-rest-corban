import { motivoRepository } from '../../repositories/inventario/motivo.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const motivoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await motivoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const motivo = await motivoRepository.findByUuid(uuid);
    if (!motivo) throw ApiError.notFound('Motivo no encontrado');
    return motivo;
  },

  async create(payload, actorId) {
    return motivoRepository.create({
      codigo: payload.codigo || null,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      tipo: payload.tipo || 'OTRO',
      requiereObservacion: payload.requiereObservacion || false,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async update(uuid, payload, actorId) {
    const motivo = await this.getByUuid(uuid);
    return motivoRepository.update(motivo, { ...payload, updatedBy: actorId });
  },

  async delete(uuid, actorId) {
    const motivo = await this.getByUuid(uuid);
    await motivoRepository.softDelete(motivo, actorId);
  },
};

export default motivoService;
