import { Op } from 'sequelize';
import { User, Role, Finca } from '../../database/associations.js';
import { UsuarioRol, UsuarioFinca } from '../../database/models/pivotModels.js';

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
      include: [
        { model: Role, as: 'roles', through: { attributes: [] } },
        { model: Finca, as: 'fincas', through: { attributes: [] }, attributes: ['id', 'uuid', 'codigo', 'nombre'] },
      ],
      distinct: true,
    });
  },

  findByUuid(uuid, { includeRoles = true, includeFincas = false } = {}) {
    const include = [];
    if (includeRoles) include.push({ model: Role, as: 'roles', through: { attributes: [] } });
    if (includeFincas) include.push({ model: Finca, as: 'fincas', through: { attributes: [] } });
    return User.findOne({ where: { uuid }, include });
  },

  // Ids de las fincas asignadas a un usuario (para el JWT y el scoping de
  // datos). Consulta liviana, sin traer el modelo completo.
  async findFincaIdsByUserId(userId) {
    const filas = await UsuarioFinca.findAll({ where: { userId }, attributes: ['fincaId'], raw: true });
    return filas.map((f) => f.fincaId);
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

  async assignFinca(userId, fincaId, createdBy, { transaction } = {}) {
    return UsuarioFinca.findOrCreate({
      where: { userId, fincaId },
      defaults: { userId, fincaId, createdBy },
      transaction,
    });
  },

  removeFinca(userId, fincaId, { transaction } = {}) {
    return UsuarioFinca.destroy({ where: { userId, fincaId }, transaction });
  },
};

export default userRepository;
