import { sequelize } from '../../database/connection.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { roleRepository } from '../../repositories/seguridad/role.repository.js';
import { authRepository } from '../../repositories/seguridad/auth.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { ROLES } from '../../constants/roles.constants.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
} from '../../utils/jwt.js';

/**
 * Lista completa de permisos quemada para el rol Administrador.
 * Así el admin siempre tiene todos los permisos sin depender de
 * seeders ni de la tabla rol_permisos.
 */
const ALL_PERMISSION_CODES = Object.values(PERMISSIONS);

const buildTokenPair = async (user) => {
  const roleNames = (user.roles || []).map((r) => r.nombre);
  const roleIds = (user.roles || []).map((r) => r.id);
  const permissions = roleNames.includes(ROLES.ADMINISTRADOR)
    ? ALL_PERMISSION_CODES
    : await roleRepository.findPermissionCodesByRoleIds(roleIds);

  const accessToken = signAccessToken({
    id: user.id,
    uuid: user.uuid,
    usuario: user.usuario,
    roles: roleNames,
    permissions,
  });

  const refreshTokenPlain = generateRefreshToken();
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshTokenPlain),
    expiresAt: refreshTokenExpiryDate(),
  });

  return {
    accessToken,
    refreshToken: refreshTokenPlain,
    user: { ...user.toSafeJSON(), roles: roleNames, permissions },
  };
};

export const authService = {
  async login(usuario, password) {
    const user = await userRepository.findByUsuarioWithPassword(usuario);

    if (!user || !user.estado) {
      logger.warn('Intento de login fallido: usuario no encontrado o inactivo', { usuario });
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      logger.warn('Intento de login fallido: contraseña incorrecta', { usuario, userId: user.id });
      throw ApiError.unauthorized('Credenciales inválidas');
    }

    logger.info('Login exitoso', { usuario, userId: user.id });
    return buildTokenPair(user);
  },

  async refresh(refreshTokenPlain) {
    const tokenHash = hashRefreshToken(refreshTokenPlain);
    const storedToken = await authRepository.findByTokenHash(tokenHash);

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token inválido o expirado');
    }

    return sequelize.transaction(async (transaction) => {
      await authRepository.revoke(storedToken, { transaction });
      const user = await userRepository.findById(storedToken.userId);
      if (!user || !user.estado) {
        throw ApiError.unauthorized('Usuario no encontrado o inactivo');
      }
      const fullUser = await userRepository.findByUuid(user.uuid);
      return buildTokenPair(fullUser);
    });
  },

  async logout(refreshTokenPlain) {
    const tokenHash = hashRefreshToken(refreshTokenPlain);
    const storedToken = await authRepository.findByTokenHash(tokenHash);
    if (storedToken && !storedToken.revokedAt) {
      await authRepository.revoke(storedToken);
    }
  },

  async me(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('Usuario no encontrado');
    const fullUser = await userRepository.findByUuid(user.uuid);
    return fullUser;
  },
};

export default authService;
