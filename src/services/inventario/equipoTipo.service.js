import { sequelize } from '../../database/connection.js';
import { equipoTipoRepository } from '../../repositories/inventario/equipoTipo.repository.js';
import { EquipoTipo } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';
import { assertSinDuplicado } from '../../utils/duplicadoGuard.js';

export const equipoTipoService = {
  async list(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await equipoTipoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
      estado: query.estado,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getByUuid(uuid) {
    const tipo = await equipoTipoRepository.findByUuid(uuid);
    if (!tipo) throw ApiError.notFound('Tipo de equipo no encontrado');
    return tipo;
  },

  async create(payload, actorId) {
    return sequelize.transaction(async (t) => {
      await assertSinDuplicado(EquipoTipo, { nombre: payload.nombre }, t, 'Ya existe un tipo de equipo con ese nombre');
      return equipoTipoRepository.create(
        { nombre: payload.nombre, estado: payload.estado ?? true, createdBy: actorId },
        { transaction: t },
      );
    });
  },

  async update(uuid, payload, actorId) {
    const tipo = await this.getByUuid(uuid);
    return sequelize.transaction(async (t) => {
      if (payload.nombre) {
        await assertSinDuplicado(EquipoTipo, { nombre: payload.nombre }, t, 'Ya existe un tipo de equipo con ese nombre', tipo.id);
      }
      return equipoTipoRepository.update(tipo, { ...payload, updatedBy: actorId }, { transaction: t });
    });
  },

  async delete(uuid, actorId) {
    const tipo = await this.getByUuid(uuid);
    await equipoTipoRepository.softDelete(tipo, actorId);
  },
};

export default equipoTipoService;
