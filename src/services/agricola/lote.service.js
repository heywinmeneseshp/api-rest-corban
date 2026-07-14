import { Finca } from '../../database/associations.js';
import { loteRepository } from '../../repositories/agricola/lote.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findFincaByUuidOrFail = async (fincaUuid) => {
  const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

export const loteService = {
  async listLotes(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getLoteByUuid(uuid) {
    const lote = await loteRepository.findByUuid(uuid);
    if (!lote) throw ApiError.notFound('Lote no encontrado');
    return lote;
  },

  async createLote(payload, actorId) {
    const finca = await findFincaByUuidOrFail(payload.fincaUuid);

    const existing = await loteRepository.findByFincaAndCodigo(finca.id, payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe un lote con ese código en esta finca');

    return loteRepository.create({
      fincaId: finca.id,
      codigo: payload.codigo,
      nombre: payload.nombre,
      area: payload.area,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateLote(uuid, payload, actorId) {
    const lote = await this.getLoteByUuid(uuid);
    const data = { ...payload, updatedBy: actorId };
    delete data.fincaUuid;

    if (payload.fincaUuid) {
      const finca = await findFincaByUuidOrFail(payload.fincaUuid);
      data.fincaId = finca.id;
    }

    if (payload.codigo) {
      const fincaId = data.fincaId ?? lote.fincaId;
      const existing = await loteRepository.findByFincaAndCodigo(fincaId, payload.codigo);
      if (existing && existing.id !== lote.id) {
        throw ApiError.conflict('Ya existe un lote con ese código en esta finca');
      }
    }

    return loteRepository.update(lote, data);
  },

  async deleteLote(uuid, actorId) {
    const lote = await this.getLoteByUuid(uuid);
    await loteRepository.softDelete(lote, actorId);
  },

  async listPlantas(uuid, query) {
    const lote = await this.getLoteByUuid(uuid);
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await loteRepository.findPlantasByLoteId(lote.id, { limit, offset });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },
};

export default loteService;
