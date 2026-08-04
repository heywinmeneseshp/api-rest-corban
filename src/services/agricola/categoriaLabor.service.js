import { categoriaLaborRepository } from '../../repositories/agricola/categoriaLabor.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const categoriaLaborService = {
  async listCategorias(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await categoriaLaborRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getCategoriaByUuid(uuid) {
    const categoria = await categoriaLaborRepository.findByUuid(uuid);
    if (!categoria) throw ApiError.notFound('Categoría de labor no encontrada');
    return categoria;
  },

  async createCategoria(payload, actorId) {
    const existing = await categoriaLaborRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe una categoría de labor con ese nombre');

    return categoriaLaborRepository.create({
      nombre: payload.nombre,
      orden: payload.orden ?? 0,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateCategoria(uuid, payload, actorId) {
    const categoria = await this.getCategoriaByUuid(uuid);

    if (payload.nombre) {
      const existing = await categoriaLaborRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== categoria.id) {
        throw ApiError.conflict('Ya existe una categoría de labor con ese nombre');
      }
    }

    return categoriaLaborRepository.update(categoria, { ...payload, updatedBy: actorId });
  },

  async deleteCategoria(uuid, actorId) {
    const categoria = await this.getCategoriaByUuid(uuid);
    await categoriaLaborRepository.softDelete(categoria, actorId);
  },
};

export default categoriaLaborService;
