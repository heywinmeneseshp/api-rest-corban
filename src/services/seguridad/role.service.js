import { Op } from 'sequelize';
import { Permiso, RolPermiso } from '../../database/associations.js';
import { sequelize } from '../../database/connection.js';
import { ROLES } from '../../constants/roles.constants.js';
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

  // Nota: se busca el rol SIN el include de permisos (más liviano) y no se
  // vuelve a re-consultar el rol completo al final — el front-end solo
  // necesita saber que la operación fue exitosa, no el rol entero de nuevo.
  async assignPermiso(uuid, permisoUuid, actorId) {
    const role = await roleRepository.findByUuid(uuid, { includePermisos: false });
    if (!role) throw ApiError.notFound('Rol no encontrado');
    const permiso = await findPermisoByUuidOrFail(permisoUuid);
    await roleRepository.assignPermiso(role.id, permiso.id, actorId);
  },

  // Deja al rol exactamente con `permisoUuids`: agrega los que faltan y quita los que sobran, todo o nada.
  async setPermisos(uuid, permisoUuids, actorId) {
    const role = await roleRepository.findByUuid(uuid, { includePermisos: false });
    if (!role) throw ApiError.notFound('Rol no encontrado');
    if (role.nombre === ROLES.ADMINISTRADOR) throw ApiError.badRequest('El rol Administrador tiene todos los permisos siempre; no se editan.');
    const permisos = permisoUuids.length ? await Permiso.findAll({ where: { uuid: { [Op.in]: permisoUuids } }, attributes: ['id', 'uuid'] }) : [];
    if (permisos.length !== permisoUuids.length) throw ApiError.badRequest('Uno o más permisos no existen');

    const nuevos = new Set(permisos.map((p) => p.id));
    return sequelize.transaction(async (transaction) => {
      const actuales = await RolPermiso.findAll({ where: { roleId: role.id }, attributes: ['permisoId'], transaction });
      const actualesIds = new Set(actuales.map((r) => r.permisoId));
      const aQuitar = [...actualesIds].filter((id) => !nuevos.has(id));
      const aAgregar = [...nuevos].filter((id) => !actualesIds.has(id));
      if (aQuitar.length) await RolPermiso.destroy({ where: { roleId: role.id, permisoId: { [Op.in]: aQuitar } }, transaction });
      if (aAgregar.length) {
        await RolPermiso.bulkCreate(aAgregar.map((permisoId) => ({ roleId: role.id, permisoId, createdBy: actorId })), { transaction });
      }
      return { agregados: aAgregar.length, quitados: aQuitar.length, total: nuevos.size };
    });
  },

  async removePermiso(uuid, permisoUuid) {
    const role = await roleRepository.findByUuid(uuid, { includePermisos: false });
    if (!role) throw ApiError.notFound('Rol no encontrado');
    const permiso = await findPermisoByUuidOrFail(permisoUuid);
    await roleRepository.removePermiso(role.id, permiso.id);
  },
};

export default roleService;
