import { ingredienteActivoRepository } from '../../repositories/agricola/ingredienteActivo.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const ingredienteActivoService = {
  async listIngredientesActivos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await ingredienteActivoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getIngredienteActivoByUuid(uuid) {
    const ingrediente = await ingredienteActivoRepository.findByUuid(uuid);
    if (!ingrediente) throw ApiError.notFound('Ingrediente activo no encontrado');
    return ingrediente;
  },

  async createIngredienteActivo(payload, actorId) {
    const existing = await ingredienteActivoRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un ingrediente activo con ese nombre');

    return ingredienteActivoRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      estado: payload.estado ?? true,
      createdBy: actorId,
    });
  },

  async updateIngredienteActivo(uuid, payload, actorId) {
    const ingrediente = await this.getIngredienteActivoByUuid(uuid);

    if (payload.nombre) {
      const existing = await ingredienteActivoRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== ingrediente.id) {
        throw ApiError.conflict('Ya existe un ingrediente activo con ese nombre');
      }
    }

    return ingredienteActivoRepository.update(ingrediente, { ...payload, updatedBy: actorId });
  },

  async deleteIngredienteActivo(uuid, actorId) {
    const ingrediente = await this.getIngredienteActivoByUuid(uuid);
    await ingredienteActivoRepository.softDelete(ingrediente, actorId);
  },
};

export default ingredienteActivoService;
