import { Existencia, Mezcla, MezclaVersion, MezclaComponente, Articulo, UnidadMedida } from '../../database/associations.js';
import { ApiError } from '../../utils/ApiError.js';
import { convertirACantidadBase } from '../../utils/unidadConversion.js';

// El histórico completo de `movimientos_inventario` sigue siendo la ÚNICA
// fuente de verdad (kárdex) — pero recalcular SUM() sobre TODO ese histórico
// en cada lectura/escritura se vuelve cada vez más caro a medida que crece.
// `existencias` (migración 20260826000025) es un CACHE derivado: un registro
// por (almacén, artículo) con el saldo ya sumado, que se mantiene al día acá
// mismo, en la misma transacción en la que se inserta cada movimiento. Antes
// esta lógica de suma estaba copiada de forma independiente en
// movimiento.service.js, elaboracion.service.js y ordenMantenimiento.service.js
// — ahora es la ÚNICA implementación.
export const TIPOS_ENTRADA = ['ENTRADA', 'AJUSTE_ENTRADA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_ENTRADA'];
export const TIPOS_SALIDA = ['SALIDA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'ELABORACION_SALIDA'];

// `lock: true` (solo tiene efecto dentro de una `transaction`) agrega `FOR UPDATE`
// a la consulta — como `existencias` tiene un índice único sobre
// (almacen_id, articulo_id), InnoDB toma un lock de fila puntual bajo
// REPEATABLE READ (el nivel por defecto de MySQL), lo que sí bloquea a otra
// transacción concurrente que intente leer o escribir el saldo del mismo
// almacén+artículo hasta que esta haga commit — sin este lock, dos
// escrituras simultáneas pueden leer el mismo saldo "suficiente" y las dos
// insertar, dejando existencia negativa (condición de carrera real,
// encontrada en la auditoría original).
//
// `findOrCreate` asegura que exista la fila de cache incluso para un par
// (almacén, artículo) que todavía no tuvo ningún movimiento — se crea con
// saldo 0 la primera vez que se consulta o se aplica un delta.
export async function getExistencia(almacenId, articuloId, { transaction, lock } = {}) {
  const [row] = await Existencia.findOrCreate({
    where: { almacenId, articuloId },
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
export async function assertStockSuficiente(almacenId, articuloId, cantidadRequerida, { transaction, nombreArticulo, nombreAlmacen } = {}) {
  const saldo = await getExistencia(almacenId, articuloId, { transaction, lock: true });
  if (saldo < cantidadRequerida) {
    const articulo = nombreArticulo ? ` para ${nombreArticulo}` : '';
    const almacen = nombreAlmacen ? ` en almacén ${nombreAlmacen}` : '';
    throw ApiError.badRequest(
      `Stock insuficiente${articulo}${almacen}. Disponible: ${saldo}, requerido: ${cantidadRequerida}`,
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
export async function aplicarDelta(almacenId, articuloId, delta, transaction) {
  await getExistencia(almacenId, articuloId, { transaction, lock: true }); // asegura que la fila exista y quede lockeada
  await Existencia.increment('saldo', { by: delta, where: { almacenId, articuloId }, transaction });
}

// Azúcar sobre aplicarDelta(): calcula el signo según si `tipo` es de
// entrada o de salida, para no repetir el `TIPOS_ENTRADA.includes(...) ? +1 : -1`
// en cada call-site.
export async function registrarMovimientoEnCache(almacenId, articuloId, tipo, cantidadBase, transaction) {
  const signo = TIPOS_ENTRADA.includes(tipo) ? 1 : -1;
  await aplicarDelta(almacenId, articuloId, signo * Number(cantidadBase), transaction);
}

// Señal interna (no un ApiError) para abortar con ROLLBACK una transacción
// que detectó saldo insuficiente en algún insumo, sin escribir nada — el
// caller la atrapa AFUERA de `sequelize.transaction(...)` y devuelve
// `{ requiereConfirmacion: true, advertencias }` en vez de re-lanzarla. Deja
// correr `consumirStockConReceta` completo con `forzarSaldoNegativo: true`
// (para juntar TODAS las advertencias de una sola pasada, no solo la
// primera) y decide al final si de verdad hacía falta forzar.
export class RequiereConfirmacionStockError extends Error {
  constructor(advertencias) {
    super('Requiere confirmación de stock insuficiente');
    this.advertencias = advertencias;
  }
}

// Un artículo ELABORADO (producto de una mezcla) nunca tiene saldo propio en
// `existencias` — pedido explícito: cuando se usa/consume, lo que hay que
// descontar es la cantidad correspondiente de CADA insumo de su receta, no
// una fila de stock del elaborado en sí. Esta función busca la receta
// vigente de un artículo (su Mezcla, si `articuloElaboradoId` apunta a él, y
// la versión ACTIVA de esa mezcla) — devuelve `null` si el artículo no es un
// elaborado (o si es uno sin componentes cargados), en cuyo caso se trata
// como un insumo normal.
export async function resolverRecetaSiEsElaborado(articuloId, { transaction } = {}) {
  const mezcla = await Mezcla.findOne({
    where: { articuloElaboradoId: articuloId },
    include: [
      {
        model: MezclaVersion,
        as: 'versiones',
        where: { activa: true },
        required: false,
        include: [
          {
            model: MezclaComponente,
            as: 'componentes',
            include: [
              { model: Articulo, as: 'articulo' },
              { model: UnidadMedida, as: 'unidad' },
            ],
          },
        ],
      },
    ],
    transaction,
  });
  const version = mezcla?.versiones?.[0];
  if (!mezcla || !version || !version.componentes?.length) return null;
  return { mezcla, version, rendimiento: Number(mezcla.rendimiento || 1) || 1 };
}

// Descuenta stock de `articulo` en `almacenId` — si el artículo es un
// elaborado (ver resolverRecetaSiEsElaborado), NUNCA toca su propia
// Existencia: reparte `cantidadBase` proporcionalmente entre los insumos de
// su receta vigente y se llama a sí misma sobre cada uno (recursivo, para
// soportar un elaborado que a su vez usa otro elaborado como insumo). Si es
// un insumo real (hoja del árbol), ahí sí valida/descuenta su Existencia,
// igual que antes.
//
// Mismo patrón `forzarSaldoNegativo`/`advertencias` que ya usa el resto de
// la app (mezcla.service.js, elaboracion.service.js,
// racimoMovimiento.service.js): si falta stock y no se fuerza, lanza; si se
// fuerza, junta la advertencia y sigue.
//
// `onLeafConsumido(articulo, cantidadBase)` es un callback opcional que cada
// caller puede pasar para registrar su propio `MovimientoInventario` de
// salida por cada insumo real efectivamente descontado (los callers ya
// conocen el `documento`/`tipo`/costeo que corresponde a su flujo — acá solo
// se resuelve QUÉ y CUÁNTO se descuenta de verdad).
//
// `soloCostear: true` recorre el mismo árbol de receta (para poder costear
// un elaborado a partir de sus insumos reales, aunque sean varios niveles)
// pero SIN tocar stock — ni valida saldo ni descuenta Existencia, solo llama
// `onLeafConsumido` por cada hoja. Lo usa mezcla.service.js#crearElaborado
// cuando `omitirSalidaComponentes` es true (los insumos ya se descontaron al
// finalizar la prueba, acá solo hace falta el costo).
export async function consumirStockConReceta(
  almacenId,
  articulo,
  cantidadBase,
  { transaction, forzarSaldoNegativo = false, advertencias = [], visitados = new Set(), onLeafConsumido, soloCostear = false } = {},
) {
  const receta = await resolverRecetaSiEsElaborado(articulo.id, { transaction });

  if (!receta) {
    // Insumo real (hoja): se valida/descuenta su propia Existencia, tal
    // cual el comportamiento de siempre (salvo en modo soloCostear).
    if (!articulo.manejaInventario) {
      // No se le lleva inventario a este artículo (ej. Agua) — no se
      // valida saldo, no se descuenta Existencia, no se genera movimiento
      // ni se suma a costeo. Se omite por completo, incluso en
      // soloCostear. Ojo: si `articulo.manejaInventario` viene undefined
      // por un `attributes` que no lo incluyó, esto lo saltearía por
      // error — todo caller debe cargar ese campo.
      return;
    }
    if (soloCostear) {
      if (onLeafConsumido) await onLeafConsumido(articulo, cantidadBase);
      return;
    }
    const saldo = await getExistencia(almacenId, articulo.id, { transaction, lock: true });
    if (saldo < cantidadBase) {
      if (!forzarSaldoNegativo) {
        throw ApiError.badRequest(
          `Stock insuficiente para ${articulo.nombre}. Disponible: ${saldo}, requerido: ${cantidadBase}`,
        );
      }
      advertencias.push({
        articulo: articulo.nombre,
        disponible: saldo,
        requerido: cantidadBase,
        saldoResultante: saldo - cantidadBase,
        mensaje: `Stock insuficiente para ${articulo.nombre}. Disponible: ${saldo}, requerido: ${cantidadBase}. El saldo quedaría en ${saldo - cantidadBase}.`,
      });
    }
    await aplicarDelta(almacenId, articulo.id, -cantidadBase, transaction);
    if (onLeafConsumido) await onLeafConsumido(articulo, cantidadBase);
    return;
  }

  // Es un elaborado: nunca se descuenta su propia Existencia — se reparte
  // entre los insumos de su receta vigente, escalado a `cantidadBase`.
  if (visitados.has(articulo.id)) {
    throw ApiError.badRequest(`Receta circular: "${articulo.nombre}" termina usándose a sí mismo como insumo`);
  }
  visitados.add(articulo.id);

  const { version, rendimiento } = receta;
  const factor = cantidadBase / rendimiento;
  for (const comp of version.componentes) {
    const cantidadComponente = Number(comp.cantidad) * factor;
    const cantidadComponenteBase = await convertirACantidadBase(comp.articulo, comp.unidadId, cantidadComponente, { transaction });
    await consumirStockConReceta(almacenId, comp.articulo, cantidadComponenteBase, {
      transaction,
      forzarSaldoNegativo,
      advertencias,
      visitados,
      onLeafConsumido,
      soloCostear,
    });
  }
}

export default {
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  getExistencia,
  assertStockSuficiente,
  aplicarDelta,
  registrarMovimientoEnCache,
  resolverRecetaSiEsElaborado,
  consumirStockConReceta,
  RequiereConfirmacionStockError,
};
