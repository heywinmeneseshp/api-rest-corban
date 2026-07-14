import { Permiso } from '../../database/associations.js';
import { roleRepository } from '../../repositories/seguridad/role.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const findPermisoByUuidOrFail = async (permisoUuid) => {
  const permiso = await Permiso.findOne({ where: { uuid: permisoUuid } });
  if (!permiso) throw ApiError.notFound('Permiso no encontrado');
  return permiso;
};

export const roleService = {
  async listRoles(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await roleRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getRoleByUuid(uuid) {
    const role = await roleRepository.findByUuid(uuid);
    if (!role) throw ApiError.notFound('Rol no encontrado');
    return role;
  },

  async createRole(payload, actorId) {
    const existing = await roleRepository.findByNombre(payload.nombre);
    if (existing) throw ApiError.conflict('Ya existe un rol con ese nombre');

    return roleRepository.create({
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      createdBy: actorId,
    });
  },

  async updateRole(uuid, payload, actorId) {
    const role = await this.getRoleByUuid(uuid);

    if (payload.nombre) {
      const existing = await roleRepository.findByNombre(payload.nombre);
      if (existing && existing.id !== role.id) {
        throw ApiError.conflict('Ya existe un rol con ese nombre');
      }
    }

    return roleRepository.update(role, { ...payload, updatedBy: actorId });
  },

  async deleteRole(uuid, actorId) {
    const role = await this.getRoleByUuid(uuid);
    await roleRepository.softDelete(role, actorId);
  },

  async listRolePermisos(uuid) {
    const role = await this.getRoleByUuid(uuid);
    return role.permisos || [];
  },

  async assignPermiso(uuid, permisoUuid, actorId) {
    const role = await this.getRoleByUuid(uuid);
    const permiso = await findPermisoByUuidOrFail(permisoUuid);
    await roleRepository.assignPermiso(role.id, permiso.id, actorId);
    return this.getRoleByUuid(uuid);
  },

  async removePermiso(uuid, permisoUuid) {
    const role = await this.getRoleByUuid(uuid);
    const permiso = await findPermisoByUuidOrFail(permisoUuid);
    await roleRepository.removePermiso(role.id, permiso.id);
    return this.getRoleByUuid(uuid);
  },
};

export default roleService;
