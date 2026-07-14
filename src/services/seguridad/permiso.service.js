import { permisoRepository } from '../../repositories/seguridad/permiso.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

export const permisoService = {
  async listPermisos(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await permisoRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getPermisoByUuid(uuid) {
    const permiso = await permisoRepository.findByUuid(uuid);
    if (!permiso) throw ApiError.notFound('Permiso no encontrado');
    return permiso;
  },

  async createPermiso(payload, actorId) {
    const existing = await permisoRepository.findByCodigo(payload.codigo);
    if (existing) throw ApiError.conflict('Ya existe un permiso con ese código');

    return permisoRepository.create({
      codigo: payload.codigo,
      nombre: payload.nombre,
      createdBy: actorId,
    });
  },

  async updatePermiso(uuid, payload, actorId) {
    const permiso = await this.getPermisoByUuid(uuid);

    if (payload.codigo) {
      const existing = await permisoRepository.findByCodigo(payload.codigo);
      if (existing && existing.id !== permiso.id) {
        throw ApiError.conflict('Ya existe un permiso con ese código');
      }
    }

    return permisoRepository.update(permiso, { ...payload, updatedBy: actorId });
  },

  async deletePermiso(uuid, actorId) {
    const permiso = await this.getPermisoByUuid(uuid);
    await permisoRepository.softDelete(permiso, actorId);
  },
};

export default permisoService;
