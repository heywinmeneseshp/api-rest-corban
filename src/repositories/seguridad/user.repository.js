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

  // Trae de un tirón todos los usuarios cuyo login (`usuario`) esté en la
  // lista — usado por el cargue masivo para saber, ANTES de procesar fila
  // por fila, cuáles ya existen (se actualizan) y cuáles son nuevos (se
  // crean), sin una consulta por fila.
  findByUsuarios(usuarios) {
    if (!usuarios || usuarios.length === 0) return [];
    return User.findAll({ where: { usuario: { [Op.in]: usuarios } } });
  },

  // Mismo propósito que findByUsuarios, pero por email — para detectar en
  // el cargue masivo un email que ya usa OTRO usuario (login distinto),
  // caso que findByUsuarios solo no alcanza a ver.
  findByEmails(emails) {
    if (!emails || emails.length === 0) return [];
    return User.findAll({ where: { email: { [Op.in]: emails } } });
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

  // Reemplaza el conjunto COMPLETO de roles de un usuario por `roleIds`
  // (quita los que ya no estén en la lista, agrega los que falten) — usado
  // por el cargue masivo, para que volver a subir el mismo archivo con la
  // columna "roles" cambiada deje al usuario exactamente con esos roles,
  // no con la unión de los viejos más los nuevos.
  async setRoles(userId, roleIds, createdBy, { transaction } = {}) {
    await UsuarioRol.destroy({ where: { userId, roleId: { [Op.notIn]: roleIds.length ? roleIds : [0] } }, transaction });
    for (const roleId of roleIds) {
      await UsuarioRol.findOrCreate({ where: { userId, roleId }, defaults: { userId, roleId, createdBy }, transaction });
    }
  },

  // Igual que setRoles, para el conjunto de fincas asignadas.
  async setFincas(userId, fincaIds, createdBy, { transaction } = {}) {
    await UsuarioFinca.destroy({ where: { userId, fincaId: { [Op.notIn]: fincaIds.length ? fincaIds : [0] } }, transaction });
    for (const fincaId of fincaIds) {
      await UsuarioFinca.findOrCreate({ where: { userId, fincaId }, defaults: { userId, fincaId, createdBy }, transaction });
    }
  },
};

export default userRepository;
