import bcrypt from 'bcrypt';
import { sequelize } from '../../database/connection.js';
import { Role } from '../../database/associations.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, buildPaginationMeta } from '../../utils/pagination.js';

const SALT_ROUNDS = 10;

const findRoleByUuidOrFail = async (roleUuid) => {
  const role = await Role.findOne({ where: { uuid: roleUuid } });
  if (!role) throw ApiError.notFound('Rol no encontrado');
  return role;
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

  async listUserRoles(uuid) {
    const user = await this.getUserByUuid(uuid);
    return user.roles || [];
  },

  // Igual que en role.service.js: se evita el include de roles (más
  // liviano) y no se re-consulta el usuario completo al final, para no
  // sumar consultas de más contra el bridge remoto en cada clic.
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
};

export default userService;
