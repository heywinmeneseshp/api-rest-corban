import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : req.cookies?.accessToken;

  if (!token) {
    throw ApiError.unauthorized('Token de acceso no proporcionado');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.id,
      uuid: payload.uuid,
      usuario: payload.usuario,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      // null = sin restricción (Administrador); arreglo (incl. vacío) =
      // solo esas fincas. Ver src/utils/fincaScope.js para cómo se usa.
      fincaIds: payload.fincaIds === null ? null : payload.fincaIds || [],
    };
    next();
  } catch {
    throw ApiError.unauthorized('Token de acceso inválido o expirado');
  }
});

export default auth;
