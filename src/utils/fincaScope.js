import { Op } from 'sequelize';
import { ROLES } from '../constants/roles.constants.js';
import { ApiError } from './ApiError.js';

// Helper compartido para restringir qué fincas puede ver/administrar cada
// usuario. Administrador se salta esta restricción por completo (igual que
// ya se salta el sistema de permisos) — se verifica directamente contra
// `user.roles`, no contra `user.fincaIds`, para que tokens viejos (sin el
// campo fincaIds, emitidos antes de esta feature) sigan dando acceso total
// a un Administrador sin depender de que haya vuelto a iniciar sesión.
//
// Regla: un usuario SIN ninguna finca asignada ve todas (sin restricción,
// igual que antes de que existiera esta feature) — la restricción solo se
// activa una vez que se le asigna al menos una finca puntual.

// true si el usuario NO es Administrador (está sujeto a restricción).
export const tieneRestriccionDeFincas = (user) => !(user?.roles || []).includes(ROLES.ADMINISTRADOR);

// Ids de fincas permitidas para este usuario, o null si no hay restricción
// (Administrador, o cualquier usuario sin ninguna finca asignada todavía).
export const getFincaIdsPermitidas = (user) => {
  if (!tieneRestriccionDeFincas(user)) return null;
  const fincaIds = Array.isArray(user?.fincaIds) ? user.fincaIds : [];
  if (fincaIds.length === 0) return null;
  return fincaIds;
};

// Lanza ApiError.forbidden si fincaId no está entre las fincas permitidas
// del usuario. No hace nada si el usuario no tiene restricción. Se usa al
// crear/editar un registro puntual (ej. crear un lote en una finca).
export const assertFincaPermitida = (user, fincaId) => {
  const permitidas = getFincaIdsPermitidas(user);
  if (permitidas === null) return;
  if (!permitidas.includes(fincaId)) {
    throw ApiError.forbidden('No tienes acceso a esta finca');
  }
};

// Combina el filtro de finca del usuario con un `where` de Sequelize que ya
// pueda tener su propio filtro de finca (ej. ?fincaUuid=X en el query). Si
// el usuario está restringido y pide una finca fuera de su alcance, el
// resultado queda vacío (no se le revela que la finca existe). Si no pide
// ninguna finca puntual, se le agrega el filtro IN con sus fincas
// permitidas.
export const aplicarScopeFinca = (user, where = {}, campo = 'fincaId') => {
  const permitidas = getFincaIdsPermitidas(user);
  if (permitidas === null) return where;

  if (where[campo] !== undefined) {
    if (!permitidas.includes(where[campo])) return { ...where, [campo]: -1 };
    return where;
  }

  return { ...where, [campo]: { [Op.in]: permitidas } };
};

export default {
  tieneRestriccionDeFincas,
  getFincaIdsPermitidas,
  assertFincaPermitida,
  aplicarScopeFinca,
};
