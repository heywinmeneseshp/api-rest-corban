import { ApiError } from '../utils/ApiError.js';

export const permission = (...requiredCodes) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  const userPermissions = req.user.permissions || [];
  const hasPermission = requiredCodes.some((code) => userPermissions.includes(code));

  if (!hasPermission) {
    return next(ApiError.forbidden('No tiene permisos para realizar esta acción'));
  }

  next();
};

export default permission;
