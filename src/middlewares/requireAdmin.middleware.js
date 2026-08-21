import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.constants.js';

// Para acciones que no tienen un permiso granular propio y que deben quedar
// reservadas solo al rol Administrador (ej. credenciales de integración con
// Logística/banarica) — a diferencia de `permission`, que chequea códigos de
// PERMISSIONS.
export const requireAdmin = (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }
  if (!(req.user.roles || []).includes(ROLES.ADMINISTRADOR)) {
    return next(ApiError.forbidden('Solo un usuario con rol de Administrador puede realizar esta acción'));
  }
  next();
};

export default requireAdmin;
