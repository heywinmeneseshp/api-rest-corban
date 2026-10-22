import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.constants.js';

// TEMPORAL: el módulo de Inventarios todavía no tiene restricciones de rol
// definidas — el usuario decidirá más adelante dónde ponerlas (pidió
// explícitamente que por ahora cualquier usuario autenticado pueda entrar a
// cualquier endpoint de Inventarios). Sigue exigiendo login (`auth`), solo
// se salta el chequeo de permisos puntual. Quitar este bypass en cuanto
// pida las restricciones reales.
// Excepción: los permisos de Mezclas (inventario.mezclas.*) SÍ se aplican, se asignan por rol en Maestros > Roles.
const esPermisoInventario = (code) => !code.startsWith('inventario.mezclas.') && (code.startsWith('menu.inventarios') || code.startsWith('inventario.'));

export const permission = (...requiredCodes) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  // Administrador tiene todos los permisos siempre, aunque su token se haya emitido antes de que existieran los nuevos.
  if ((req.user.roles || []).includes(ROLES.ADMINISTRADOR)) {
    return next();
  }

  if (requiredCodes.every(esPermisoInventario)) {
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
