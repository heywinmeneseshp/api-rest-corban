import { categoriaPlantaRepository } from '../../repositories/agricola/categoriaPlanta.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const categoriaPlantaService = {
  async listCategorias(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await categoriaPlantaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getCategoriaByUuid(uuid) {
    const categoria = await categoriaPlantaRepository.findByUuid(uuid);
    if (!categoria) throw ApiError.notFound('Categoría de planta no encontrada');
    return categoria;
  },

  async createCategoria(payload, actorId) {
    const existing = await categoriaPlantaRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe una categoría de planta con ese nombre');

    return categoriaPlantaRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateCategoria(uuid, payload, actorId) {
    const categoria = await this.getCategoriaByUuid(uuid);

    if (payload.nombre) {
      const existing = await categoriaPlantaRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== categoria.id) {
        throw ApiError.conflict('Ya existe una categoría de planta con ese nombre');
      }
    }

    return categoriaPlantaRepository.update(categoria, { ...payload, updatedBy: actorId });
  },

  async deleteCategoria(uuid, actorId) {
    const categoria = await this.getCategoriaByUuid(uuid);
    await categoriaPlantaRepository.softDelete(categoria, actorId);
  },
};

export default categoriaPlantaService;
