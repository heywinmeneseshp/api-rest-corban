import { Op } from 'sequelize';
import { ROLES } from '../constants/roles.constants.js';
import { ApiError } from './ApiError.js';

// Helper compartido para restringir qué almacenes (y, por extensión, qué
// artículos asignados a ellos) puede ver/administrar cada usuario. Mismo
// criterio que fincaScope.js: Administrador se salta esta restricción por
// completo; cualquier otro usuario SIN ningún almacén asignado ve todos
// (sin restricción) — la restricción solo se activa una vez que se le
// asigna al menos un almacén puntual.

// true si el usuario NO es Administrador (está sujeto a restricción).
export const tieneRestriccionDeAlmacenes = (user) => !(user?.roles || []).includes(ROLES.ADMINISTRADOR);

// Ids de almacenes permitidos para este usuario, o null si no hay
// restricción (Administrador, o cualquier usuario sin ningún almacén
// asignado todavía).
export const getAlmacenIdsPermitidas = (user) => {
  if (!tieneRestriccionDeAlmacenes(user)) return null;
  const almacenIds = Array.isArray(user?.almacenIds) ? user.almacenIds : [];
  if (almacenIds.length === 0) return null;
  return almacenIds;
};

// Lanza ApiError.forbidden si almacenId no está entre los almacenes
// permitidos del usuario. No hace nada si el usuario no tiene restricción.
export const assertAlmacenPermitido = (user, almacenId) => {
  const permitidas = getAlmacenIdsPermitidas(user);
  if (permitidas === null) return;
  if (!permitidas.includes(almacenId)) {
    throw ApiError.forbidden('No tienes acceso a este almacén');
  }
};

// Combina el filtro de almacén del usuario con un `where` de Sequelize que
// ya pueda tener su propio filtro (ej. ?almacenUuid=X en el query). Mismo
// criterio que aplicarScopeFinca.
export const aplicarScopeAlmacen = (user, where = {}, campo = 'almacenId') => {
  const permitidas = getAlmacenIdsPermitidas(user);
  if (permitidas === null) return where;

  if (where[campo] !== undefined) {
    if (!permitidas.includes(where[campo])) return { ...where, [campo]: -1 };
    return where;
  }

  return { ...where, [campo]: { [Op.in]: permitidas } };
};

export default {
  tieneRestriccionDeAlmacenes,
  getAlmacenIdsPermitidas,
  assertAlmacenPermitido,
  aplicarScopeAlmacen,
};
