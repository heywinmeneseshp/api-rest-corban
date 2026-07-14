import { Op } from 'sequelize';
import { User, Role } from '../../database/associations.js';
import { UsuarioRol } from '../../database/models/pivotModels.js';

export const userRepository = {
  async findAndCountAll({ limit, offset, search }) {
    const where = search
      ? {
          [Op.or]: [
            { usuario: { [Op.like]: `%${search}%` } },
            { nombre: { [Op.like]: `%${search}%` } },
            { apellido: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    return User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['id', 'ASC']],
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    });
  },

  findByUuid(uuid, { includeRoles = true } = {}) {
    return User.findOne({
      where: { uuid },
      include: includeRoles ? [{ model: Role, as: 'roles', through: { attributes: [] } }] : [],
    });
  },

  findById(id) {
    return User.findByPk(id);
  },

  findByUsuarioWithPassword(usuario) {
    return User.scope('withPassword').findOne({
      where: { usuario },
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    });
  },

  findByUsuarioOrEmail(usuario, email) {
    return User.findOne({ where: { [Op.or]: [{ usuario }, { email }] } });
  },

  create(data, { transaction } = {}) {
    return User.create(data, { transaction });
  },

  async update(user, data, { transaction } = {}) {
    await user.update(data, { transaction });
    return user;
  },

  async softDelete(user, deletedBy, { transaction } = {}) {
    await user.update({ deletedBy }, { transaction });
    await user.destroy({ transaction });
    return user;
  },

  async assignRole(userId, roleId, createdBy, { transaction } = {}) {
    return UsuarioRol.findOrCreate({
      where: { userId, roleId },
      defaults: { userId, roleId, createdBy },
      transaction,
    });
  },

  removeRole(userId, roleId, { transaction } = {}) {
    return UsuarioRol.destroy({ where: { userId, roleId }, transaction });
  },
};

export default userRepository;
