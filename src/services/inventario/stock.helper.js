import { fn, literal } from 'sequelize';
import { MovimientoInventario } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// No existe una tabla `existencias` materializada — el stock siempre se calcula
// sumando el historial completo de `movimientos_inventario` (ver
// movimiento.repository.js#getExistencias/getKardex, mismo criterio). Esta es la
// ÚNICA implementación de esa suma — antes estaba copiada de forma independiente
// en movimiento.service.js, elaboracion.service.js y ordenMantenimiento.service.js,
// con riesgo de que la lista de tipos "entrada" se desincronizara entre las tres.
export const TIPOS_ENTRADA = ['ENTRADA', 'AJUSTE_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_ENTRADA'];
export const TIPOS_SALIDA = ['SALIDA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'ELABORACION_SALIDA'];

// `lock: true` (solo tiene efecto dentro de una `transaction`) agrega `FOR UPDATE`
// a la consulta — como hay un índice sobre (almacen_id, producto_id), InnoDB toma
// un next-key/gap lock sobre ese rango bajo REPEATABLE READ (el nivel por defecto
// de MySQL), lo que sí bloquea a otra transacción concurrente que intente leer o
// insertar movimientos del mismo almacén+producto hasta que esta haga commit —
// sin este lock, dos escrituras simultáneas pueden leer el mismo saldo "suficiente"
// y las dos insertar, dejando existencia negativa (condición de carrera real, no
// solo teórica, encontrada en la auditoría).
export async function getExistencia(almacenId, productoId, { transaction, lock } = {}) {
  const result = await MovimientoInventario.findOne({
    where: { almacenId, productoId },
    attributes: [[fn('SUM', literal(`CASE WHEN tipo IN ('${TIPOS_ENTRADA.join("','")}') THEN cantidad_base ELSE -cantidad_base END`)), 'saldo']],
    raw: true,
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  return Number(result?.saldo || 0);
}

// Valida que haya stock suficiente y lanza ApiError.badRequest si no — pensado para
// llamarse SIEMPRE dentro de una transacción con `lock: true` justo antes de crear
// el movimiento de salida correspondiente, para que el check y el insert queden
// atómicos (nada puede colarse entre medio una vez tomado el lock).
export async function assertStockSuficiente(almacenId, productoId, cantidadRequerida, { transaction, nombreProducto, nombreAlmacen } = {}) {
  const saldo = await getExistencia(almacenId, productoId, { transaction, lock: true });
  if (saldo < cantidadRequerida) {
    const producto = nombreProducto ? ` para ${nombreProducto}` : '';
    const almacen = nombreAlmacen ? ` en almacén ${nombreAlmacen}` : '';
    throw ApiError.badRequest(
      `Stock insuficiente${producto}${almacen}. Disponible: ${saldo}, requerido: ${cantidadRequerida}`,
    );
  }
  return saldo;
}

export default { TIPOS_ENTRADA, TIPOS_SALIDA, getExistencia, assertStockSuficiente };
