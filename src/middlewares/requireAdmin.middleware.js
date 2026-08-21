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

// Más estricto que requireAdmin: un Administrador con fincas asignadas
// sigue viendo todos los datos del sistema (ver fincaScope.js), pero no
// debe poder eliminar evaluaciones ni tocar la configuración de avisos por
// correo de Sanidad Vegetal — Evaluación de Labores. Esas acciones quedan
// reservadas solo al administrador del sistema (sin ninguna finca asignada).
export const requireAdminGlobal = (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }
  if (!(req.user.roles || []).includes(ROLES.ADMINISTRADOR) || !req.user.administradorGlobal) {
    return next(
      ApiError.forbidden('Solo el administrador del sistema (sin fincas asignadas) puede realizar esta acción'),
    );
  }
  next();
};

export default requireAdmin;
