import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { User, Role, Finca } from '../../database/associations.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { mailService } from '../sistema/mail.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const SALT_ROUNDS = 10;

const findRoleByUuidOrFail = async (roleUuid) => {
  const role = await Role.findOne({ where: { uuid: roleUuid } });
  if (!role) throw ApiError.notFound('Rol no encontrado');
  return role;
};

const findFincaByUuidOrFail = async (fincaUuid) => {
  const finca = await Finca.findOne({ where: { uuid: fincaUuid } });
  if (!finca) throw ApiError.notFound('Finca no encontrada');
  return finca;
};

export const userService = {
  async listUsers(query) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await userRepository.findAndCountAll({
      limit,
      offset,
      search: query.search,
    });
    return { items: rows, meta: buildPaginationMeta({ page, limit, total: count }) };
  },

  async getUserByUuid(uuid) {
    const user = await userRepository.findByUuid(uuid);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    return user;
  },

  async createUser(payload, actorId) {
    const existing = await userRepository.findByUsuarioOrEmail(payload.usuario, payload.email);
    if (existing) {
      throw ApiError.conflict('El usuario o email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const user = await sequelize.transaction((transaction) =>
      userRepository.create(
        {
          usuario: payload.usuario,
          nombre: payload.nombre,
          apellido: payload.apellido,
          email: payload.email,
          password: hashedPassword,
          estado: payload.estado ?? true,
          createdBy: actorId,
        },
        { transaction },
      ),
    );
    return user.toSafeJSON();
  },

  async updateUser(uuid, payload, actorId) {
    const user = await this.getUserByUuid(uuid);

    if (payload.usuario || payload.email) {
      const existing = await userRepository.findByUsuarioOrEmail(
        payload.usuario ?? user.usuario,
        payload.email ?? user.email,
      );
      if (existing && existing.id !== user.id) {
        throw ApiError.conflict('El usuario o email ya está registrado');
      }
    }

    const data = { ...payload, updatedBy: actorId };
    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, SALT_ROUNDS);
    }

    const updated = await userRepository.update(user, data);
    return updated.toSafeJSON();
  },

  async deleteUser(uuid, actorId) {
    const user = await this.getUserByUuid(uuid);
    await userRepository.softDelete(user, actorId);
  },

  async bulkResetPassword(uuids) {
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
      throw ApiError.badRequest('Debes enviar al menos un usuario');
    }

    const users = await User.findAll({ where: { uuid: uuids } });

    if (users.length === 0) {
      throw ApiError.notFound('Ningún usuario encontrado');
    }

    const results = [];

    for (const user of users) {
      const newPassword = crypto.randomBytes(4).toString('hex');
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await user.update({ password: hashedPassword });
      try {
        await mailService.sendPasswordReset(user.toSafeJSON(), newPassword);
        results.push({ uuid: user.uuid, usuario: user.usuario, email: user.email, ok: true });
      } catch {
        results.push({ uuid: user.uuid, usuario: user.usuario, email: user.email, ok: false });
      }
    }

    return results;
  },

  async listUserRoles(uuid) {
    const user = await this.getUserByUuid(uuid);
    return user.roles || [];
  },

  // Igual que en role.service.js: se evita el include de roles (más
  // liviano) y no se re-consulta el usuario completo al final.
  async assignRole(uuid, roleUuid, actorId) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const role = await findRoleByUuidOrFail(roleUuid);
    await userRepository.assignRole(user.id, role.id, actorId);
  },

  async removeRole(uuid, roleUuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const role = await findRoleByUuidOrFail(roleUuid);
    await userRepository.removeRole(user.id, role.id);
  },

  async listUserFincas(uuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false, includeFincas: true });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    return user.fincas || [];
  },

  async assignFinca(uuid, fincaUuid, actorId) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await userRepository.assignFinca(user.id, finca.id, actorId);
  },

  async removeFinca(uuid, fincaUuid) {
    const user = await userRepository.findByUuid(uuid, { includeRoles: false });
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const finca = await findFincaByUuidOrFail(fincaUuid);
    await userRepository.removeFinca(user.id, finca.id);
  },
};

export default userService;
