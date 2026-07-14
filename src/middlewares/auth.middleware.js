import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Token de acceso no proporcionado');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.id,
      uuid: payload.uuid,
      usuario: payload.usuario,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };
    next();
  } catch {
    throw ApiError.unauthorized('Token de acceso inválido o expirado');
  }
});

export default auth;
