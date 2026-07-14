import { tipoEvaluacionRepository } from '../../repositories/agricola/tipoEvaluacion.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const tipoEvaluacionService = {
  async listTipos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await tipoEvaluacionRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getTipoByUuid(uuid) {
    const tipo = await tipoEvaluacionRepository.findByUuid(uuid);
    if (!tipo) throw ApiError.notFound('Tipo de evaluación no encontrado');
    return tipo;
  },

  async createTipo(payload, actorId) {
    const existing = await tipoEvaluacionRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un tipo de evaluación con ese nombre');

    return tipoEvaluacionRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateTipo(uuid, payload, actorId) {
    const tipo = await this.getTipoByUuid(uuid);

    if (payload.nombre) {
      const existing = await tipoEvaluacionRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== tipo.id) {
        throw ApiError.conflict('Ya existe un tipo de evaluación con ese nombre');
      }
    }

    return tipoEvaluacionRepository.update(tipo, { ...payload, updatedBy: actorId });
  },

  async deleteTipo(uuid, actorId) {
    const tipo = await this.getTipoByUuid(uuid);
    await tipoEvaluacionRepository.softDelete(tipo, actorId);
  },
};

export default tipoEvaluacionService;
