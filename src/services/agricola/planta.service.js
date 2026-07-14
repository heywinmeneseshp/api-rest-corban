import { Lote, CategoriaPlanta } from '../../database/associations.js';
import { plantaRepository } from '../../repositories/agricola/planta.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findLoteByUuidOrFail = async (loteUuid) => {
  const lote = await Lote.findOne({ where: { uuid: loteUuid } });
  if (!lote) throw ApiError.notFound('Lote no encontrado');
  return lote;
};

const findCategoriaByUuidOrFail = async (categoriaUuid) => {
  const categoria = await CategoriaPlanta.findOne({ where: { uuid: categoriaUuid } });
  if (!categoria) throw ApiError.notFound('Categoría de planta no encontrada');
  return categoria;
};

export const plantaService = {
  async listPlantas(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await plantaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getPlantaByUuid(uuid) {
    const planta = await plantaRepository.findByUuid(uuid);
    if (!planta) throw ApiError.notFound('Planta no encontrada');
    return planta;
  },

  async createPlanta(payload, actorId) {
    const lote = await findLoteByUuidOrFail(payload.loteUuid);
    const categoria = await findCategoriaByUuidOrFail(payload.categoriaPlantaUuid);

    const existing = await plantaRepository.findByLoteAndCodigo(lote.id, payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe una planta con ese código en este lote');

    return plantaRepository.create({
      loteId: lote.id,
      codigo: payload.codigo,
      categoriaPlantaId: categoria.id,
      latitud: payload.latitud,
      longitud: payload.longitud,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updatePlanta(uuid, payload, actorId) {
    const planta = await this.getPlantaByUuid(uuid);
    const data = { updatedBy: actorId };

    if (payload.loteUuid) {
      const lote = await findLoteByUuidOrFail(payload.loteUuid);
      data.loteId = lote.id;
    }
    if (payload.categoriaPlantaUuid) {
      const categoria = await findCategoriaByUuidOrFail(payload.categoriaPlantaUuid);
      data.categoriaPlantaId = categoria.id;
    }
    if (payload.codigo !== undefined) data.codigo = payload.codigo;
    if (payload.latitud !== undefined) data.latitud = payload.latitud;
    if (payload.longitud !== undefined) data.longitud = payload.longitud;
    if (payload.estado !== undefined) data.estado = payload.estado;

    if (payload.codigo) {
      const loteId = data.loteId ?? planta.loteId;
      const existing = await plantaRepository.findByLoteAndCodigo(loteId, payload.codigo);
      if (existing && existing.id !== planta.id) {
        throw ApiError.conflict('Ya existe una planta con ese código en este lote');
      }
    }

    return plantaRepository.update(planta, data);
  },

  async deletePlanta(uuid, actorId) {
    const planta = await this.getPlantaByUuid(uuid);
    await plantaRepository.softDelete(planta, actorId);
  },

  async listEvaluaciones(uuid, query) {
    const planta = await this.getPlantaByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await plantaRepository.findEvaluacionesByPlantaId(planta.id, {
      limit,
      offset,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },
};

export default plantaService;
