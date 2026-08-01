import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sequelize } from '../../database/connection.js';
import { User } from '../../database/models/user.model.js';
import { userRepository } from '../../repositories/seguridad/user.repository.js';
import { roleRepository } from '../../repositories/seguridad/role.repository.js';
import { authRepository } from '../../repositories/seguridad/auth.repository.js';
import { mailService } from '../sistema/mail.service.js';
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
  const esAdmin = roleNames.includes(ROLES.ADMINISTRADOR);
  const permissions = esAdmin
    ? ALL_PERMISSION_CODES
    : await roleRepository.findPermissionCodesByRoleIds(roleIds);

  // Fincas asignadas al usuario (para restringir qué datos puede ver/crear
  // /editar). Administrador se salta esta restricción por completo (igual
  // que ya se salta la tabla rol_permisos): fincaIds=null significa "sin
  // restricción, ve todas las fincas". Para cualquier otro usuario, un
  // arreglo vacío significa que no ve ningún dato hasta que se le asignen
  // fincas explícitamente.
  const fincaIds = esAdmin ? null : await userRepository.findFincaIdsByUserId(user.id);

  const accessToken = signAccessToken({
    id: user.id,
    uuid: user.uuid,
    usuario: user.usuario,
    roles: roleNames,
    permissions,
    fincaIds,
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
    user: { ...user.toSafeJSON(), roles: roleNames, permissions, fincaIds },
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

    // findByUuid trae `roles` como instancias completas del modelo Role
    // ({id, uuid, nombre, ...}). login/refresh en cambio devuelven `roles`
    // como array de nombres (strings) — normalizamos acá para que ambos
    // endpoints tengan la misma forma; si no, el cliente que renderiza
    // roles.join(', ') muestra "[object Object]" cuando la sesión se
    // recargó desde /auth/me en vez de login/refresh.
    const roleNames = (fullUser.roles || []).map((r) => r.nombre);
    return { ...fullUser.toSafeJSON(), roles: roleNames };
  },

  async updateProfile(userId, payload) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    if (payload.email && payload.email !== user.email) {
      const existing = await userRepository.findByUsuarioOrEmail(null, payload.email);
      if (existing) throw ApiError.conflict('El email ya está registrado por otro usuario');
    }

    const updated = await userRepository.update(user, payload);
    return updated.toSafeJSON();
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    const fullUser = await User.scope('withPassword').findOne({ where: { uuid: user.uuid } });
    if (!fullUser) throw ApiError.notFound('Usuario no encontrado');

    const passwordMatches = await fullUser.comparePassword(currentPassword);
    if (!passwordMatches) {
      throw ApiError.badRequest('La contraseña actual es incorrecta');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(fullUser, { password: hashedPassword });
  },

  // Sin importar si el usuario/email existe, esta función nunca lanza error
  // ni distingue el caso en su valor de retorno — el controller siempre
  // responde el mismo mensaje genérico. Es deliberado: evita que alguien
  // use este endpoint público para averiguar qué usuarios existen en el
  // sistema (enumeración de cuentas).
  async forgotPassword(usuarioOrEmail) {
    const user = await userRepository.findByUsuarioOrEmail(usuarioOrEmail, usuarioOrEmail);
    if (!user || !user.estado) {
      logger.info('Forgot-password: usuario no encontrado o inactivo', { usuarioOrEmail });
      return;
    }

    const newPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user, { password: hashedPassword });

    try {
      await mailService.sendPasswordReset(user.toSafeJSON(), newPassword);
      logger.info('Forgot-password: correo enviado', { userId: user.id });
    } catch (err) {
      logger.error('Forgot-password: fallo al enviar correo', { userId: user.id, error: err.message });
    }
  },
};

export default authService;
