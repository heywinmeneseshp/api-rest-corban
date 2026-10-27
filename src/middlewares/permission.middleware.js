import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.constants.js';

export const permission = (...requiredCodes) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  // Administrador tiene todos los permisos siempre, aunque su token se haya emitido antes de que existieran los nuevos.
  if ((req.user.roles || []).includes(ROLES.ADMINISTRADOR)) {
    return next();
  }

  const userPermissions = req.user.permissions || [];
  const hasPermission = requiredCodes.some((code) => userPermissions.includes(code));

  if (!hasPermission) {
    return next(ApiError.forbidden('No tiene permisos para realizar esta acción'));
  }

  next();
};

export default permission;
