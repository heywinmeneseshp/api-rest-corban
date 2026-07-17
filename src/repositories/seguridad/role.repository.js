import { Op } from 'sequelize';
import { Role, Permiso } from '../../database/associations.js';
import { RolPermiso } from '../../database/models/pivotModels.js';

export const roleRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { descripcion: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return Role.findAndCountAll({
      where,
      limit,
      offset,
      order: [['id', 'ASC']],
    });
  },

  findByUuid(uuid, { includePermisos = true } = {}) {
    return Role.findOne({
      where: { uuid },
      include: includePermisos ? [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] : [],
    });
  },

  findById(id) {
    return Role.findByPk(id);
  },

  findByNombre(nombre) {
    return Role.findOne({ where: { nombre } });
  },

  create(data, { transaction } = {}) {
    return Role.create(data, { transaction });
  },

  async update(role, data, { transaction } = {}) {
    await role.update(data, { transaction });
    return role;
  },

  async softDelete(role, deletedBy, { transaction } = {}) {
    await role.update({ deletedBy }, { transaction });
    await role.destroy({ transaction });
    return role;
  },

  assignPermiso(roleId, permisoId, createdBy, { transaction } = {}) {
    return RolPermiso.findOrCreate({
      where: { roleId, permisoId },
      defaults: { roleId, permisoId, createdBy },
      transaction,
    });
  },

  removePermiso(roleId, permisoId, { transaction } = {}) {
    return RolPermiso.destroy({ where: { roleId, permisoId }, transaction });
  },

  async findPermissionCodesByRoleIds(roleIds) {
    if (!roleIds.length) return [];
    const roles = await Role.findAll({
      where: { id: roleIds },
      include: [{ model: Permiso, as: 'permisos', through: { attributes: [] }, attributes: ['codigo'] }],
    });
    const codes = roles.flatMap((role) => role.permisos.map((p) => p.codigo));
    return [...new Set(codes)];
  },

  async findAllPermissionCodes() {
    const permisos = await Permiso.findAll({ attributes: ['codigo'] });
    return permisos.map((p) => p.codigo);
  },
};

export default roleRepository;
