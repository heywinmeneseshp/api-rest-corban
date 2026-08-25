import { productoCategoriaRepository } from '../../repositories/inventario/productoCategoria.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const productoCategoriaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await productoCategoriaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const cat = await productoCategoriaRepository.findByUuid(uuid);
    if (!cat) throw ApiError.notFound('Categoría no encontrada');
    return cat;
  },

  async create(payload, actorId) {
    const existing = await productoCategoriaRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe una categoría con ese nombre');

    return productoCategoriaRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      tipo: payload.tipo || 'GENERAL',
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async update(uuid, payload, actorId) {
    const cat = await this.getByUuid(uuid);
    if (payload.nombre) {
      const existing = await productoCategoriaRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== cat.id) throw ApiError.conflict('Ya existe una categoría con ese nombre');
    }
    return productoCategoriaRepository.update(cat, { ...payload, updatedBy: actorId });
  },

  async delete(uuid, actorId) {
    const cat = await this.getByUuid(uuid);
    await productoCategoriaRepository.softDelete(cat, actorId);
  },
};

export default productoCategoriaService;
