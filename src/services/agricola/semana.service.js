import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const semanaService = {
  async listSemanas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await semanaRepository.findAndCountAll({
      limit,
      offset,
      anio: query.anio ? Number(query.anio) : undefined,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getSemanaByUuid(uuid) {
    const semana = await semanaRepository.findByUuid(uuid);
    if (!semana) throw ApiError.notFound('Semana no encontrada');
    return semana;
  },

  async createSemana(payload, actorId) {
    const existingCodigo = await semanaRepository.findByCodigo(payload.codigo);
    if (existingCodigo) throw ApiError.conflict('Ya existe una semana con ese código');

    const existingNumero = await semanaRepository.findByAnioAndNumero(
      payload.anio,
      payload.numeroSemana,
    );
    if (existingNumero) throw ApiError.conflict('Ya existe esa semana para el año indicado');

    return semanaRepository.create({
      codigo: payload.codigo,
      numeroSemana: payload.numeroSemana,
      anio: payload.anio,
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateSemana(uuid, payload, actorId) {
    const semana = await this.getSemanaByUuid(uuid);

    if (payload.codigo) {
      const existing = await semanaRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== semana.id) {
        throw ApiError.conflict('Ya existe una semana con ese código');
      }
    }

    if (payload.anio !== undefined || payload.numeroSemana !== undefined) {
      const anio = payload.anio ?? semana.anio;
      const numeroSemana = payload.numeroSemana ?? semana.numeroSemana;
      const existing = await semanaRepository.findByAnioAndNumero(anio, numeroSemana);
      if (existing && existing.id !== semana.id) {
        throw ApiError.conflict('Ya existe esa semana para el año indicado');
      }
    }

    return semanaRepository.update(semana, { ...payload, updatedBy: actorId });
  },

  async deleteSemana(uuid, actorId) {
    const semana = await this.getSemanaByUuid(uuid);
    await semanaRepository.softDelete(semana, actorId);
  },
};

export default semanaService;
