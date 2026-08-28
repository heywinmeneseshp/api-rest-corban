import { ApiError } from './ApiError.js';

// Antes, el chequeo de "¿ya existe un registro con este nombre/código?" era
// un SELECT suelto seguido de un INSERT aparte (check-then-act), sin
// transacción ni lock — dos requests casi simultáneas podían pasar ambas el
// chequeo antes de que cualquiera insertara, dejando dos registros
// "duplicados" reales en las tablas que no tienen UNIQUE en esa columna a
// nivel de base (almacenes.nombre, mezclas.nombre/codigo — ver migración
// 20260826000030). Este helper hace el chequeo CON lock de fila, dentro de
// la misma transacción en la que se va a crear/actualizar el registro, para
// que el chequeo y el create/update queden atómicos.
export async function assertSinDuplicado(Model, where, transaction, mensaje, excludeId) {
  const existing = await Model.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
  if (existing && existing.id !== excludeId) {
    throw ApiError.conflict(mensaje);
  }
}

export default { assertSinDuplicado };
