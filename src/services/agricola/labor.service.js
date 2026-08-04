import { laborRepository } from '../../repositories/agricola/labor.repository.js';
import { categoriaLaborRepository } from '../../repositories/agricola/categoriaLabor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findCategoriaOrFail = async (categoriaLaborUuidOrId, byId = false) => {
  const categoria = byId
    ? await categoriaLaborRepository.findById(categoriaLaborUuidOrId)
    : await categoriaLaborRepository.findByUuid(categoriaLaborUuidOrId);
  if (!categoria) throw ApiError.notFound('Categoría de labor no encontrada');
  return categoria;
};

export const laborService = {
  async listLabores(query) {
    const { page, limit, offset } = getPagination(query);
    let categoriaLaborId;
    if (query.categoriaLaborUuid) {
      categoriaLaborId = (await findCategoriaOrFail(query.categoriaLaborUuid)).id;
    }
    const { rows, count } = await laborRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      categoriaLaborId,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getLaborByUuid(uuid) {
    const labor = await laborRepository.findByUuid(uuid);
    if (!labor) throw ApiError.notFound('Labor no encontrada');
    return labor;
  },

  async createLabor(payload, actorId) {
    const categoria = await findCategoriaOrFail(payload.categoriaLaborUuid);

    const existing = await laborRepository.findByCategoriaAndNombre(categoria.id, payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe una labor con ese nombre en esta categoría');

    return laborRepository.create({
      categoriaLaborId: categoria.id,
      nombre: payload.nombre,
      color: payload.color ?? '#16a34a',
      icono: payload.icono || 'FiClipboard',
      duracionDefaultMinutos: payload.duracionDefaultMinutos,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateLabor(uuid, payload, actorId) {
    const labor = await this.getLaborByUuid(uuid);
    const data = { ...payload, updatedBy: actorId };
    delete data.categoriaLaborUuid;

    if (payload.categoriaLaborUuid) {
      const categoria = await findCategoriaOrFail(payload.categoriaLaborUuid);
      data.categoriaLaborId = categoria.id;
    }

    if (payload.nombre) {
      const categoriaLaborId = data.categoriaLaborId ?? labor.categoriaLaborId;
      const existing = await laborRepository.findByCategoriaAndNombre(categoriaLaborId, payload.nombre);
      if (existing && existing.id !== labor.id) {
        throw ApiError.conflict('Ya existe una labor con ese nombre en esta categoría');
      }
    }

    return laborRepository.update(labor, data);
  },

  async deleteLabor(uuid, actorId) {
    const labor = await this.getLaborByUuid(uuid);
    await laborRepository.softDelete(labor, actorId);
  },
};

export default laborService;
