import { Existencia } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';

// El histórico completo de `movimientos_inventario` sigue siendo la ÚNICA
// fuente de verdad (kárdex) — pero recalcular SUM() sobre TODO ese histórico
// en cada lectura/escritura se vuelve cada vez más caro a medida que crece.
// `existencias` (migración 20260826000025) es un CACHE derivado: un registro
// por (almacén, producto) con el saldo ya sumado, que se mantiene al día acá
// mismo, en la misma transacción en la que se inserta cada movimiento. Antes
// esta lógica de suma estaba copiada de forma independiente en
// movimiento.service.js, elaboracion.service.js y ordenMantenimiento.service.js
// — ahora es la ÚNICA implementación.
export const TIPOS_ENTRADA = ['ENTRADA', 'AJUSTE_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_ENTRADA'];
export const TIPOS_SALIDA = ['SALIDA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'ELABORACION_SALIDA'];

// `lock: true` (solo tiene efecto dentro de una `transaction`) agrega `FOR UPDATE`
// a la consulta — como `existencias` tiene un índice único sobre
// (almacen_id, producto_id), InnoDB toma un lock de fila puntual bajo
// REPEATABLE READ (el nivel por defecto de MySQL), lo que sí bloquea a otra
// transacción concurrente que intente leer o escribir el saldo del mismo
// almacén+producto hasta que esta haga commit — sin este lock, dos
// escrituras simultáneas pueden leer el mismo saldo "suficiente" y las dos
// insertar, dejando existencia negativa (condición de carrera real,
// encontrada en la auditoría original).
//
// `findOrCreate` asegura que exista la fila de cache incluso para un par
// (almacén, producto) que todavía no tuvo ningún movimiento — se crea con
// saldo 0 la primera vez que se consulta o se aplica un delta.
export async function getExistencia(almacenId, productoId, { transaction, lock } = {}) {
  const [row] = await Existencia.findOrCreate({
    where: { almacenId, productoId },
    defaults: { saldo: 0 },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  return Number(row.saldo);
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

// Aplica un delta (positivo para entrada, negativo para salida) al saldo
// cacheado — llamar SIEMPRE dentro de la misma transacción en la que se
// insertó el `MovimientoInventario` correspondiente, justo después de
// crearlo, para que el cache nunca quede desincronizado del histórico real.
// `transaction` es obligatorio acá (a diferencia de `getExistencia`) porque
// esto es siempre una escritura de negocio, nunca una lectura suelta.
export async function aplicarDelta(almacenId, productoId, delta, transaction) {
  await getExistencia(almacenId, productoId, { transaction, lock: true }); // asegura que la fila exista y quede lockeada
  await Existencia.increment('saldo', { by: delta, where: { almacenId, productoId }, transaction });
}

// Azúcar sobre aplicarDelta(): calcula el signo según si `tipo` es de
// entrada o de salida, para no repetir el `TIPOS_ENTRADA.includes(...) ? +1 : -1`
// en cada call-site.
export async function registrarMovimientoEnCache(almacenId, productoId, tipo, cantidadBase, transaction) {
  const signo = TIPOS_ENTRADA.includes(tipo) ? 1 : -1;
  await aplicarDelta(almacenId, productoId, signo * Number(cantidadBase), transaction);
}

export default {
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  getExistencia,
  assertStockSuficiente,
  aplicarDelta,
  registrarMovimientoEnCache,
};
