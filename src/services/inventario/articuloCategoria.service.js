import { articuloCategoriaRepository } from '../../repositories/inventario/articuloCategoria.repository.js';
import { ArticuloCategoria } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';
import { sequelize } from '../../database/connection.js';

export const articuloCategoriaService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await articuloCategoriaRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      tipo: query.tipo,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const cat = await articuloCategoriaRepository.findByUuid(uuid);
    if (!cat) throw ApiError.notFound('Categoría no encontrada');
    return cat;
  },

  async create(payload, actorId) {
    return sequelize.transaction(async (t) => {
      await assertSinDuplicado(ArticuloCategoria, { nombre: payload.nombre }, t, 'Ya existe una categoría con ese nombre');
      return articuloCategoriaRepository.create(
        {
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          tipo: payload.tipo || 'GENERAL',
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction: t },
      );
    });
  },

  async update(uuid, payload, actorId) {
    const cat = await this.getByUuid(uuid);
    return sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(ArticuloCategoria, { nombre: payload.nombre }, t, 'Ya existe una categoría con ese nombre', cat.id);
      }
      return articuloCategoriaRepository.update(cat, { ...payload, updatedBy: actorId }, { transaction: t });
    });
  },

  async delete(uuid, actorId) {
    const cat = await this.getByUuid(uuid);
    await articuloCategoriaRepository.softDelete(cat, actorId);
  },
};

export default articuloCategoriaService;
