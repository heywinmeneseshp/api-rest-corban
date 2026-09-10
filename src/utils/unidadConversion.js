import { UnidadConversion, UnidadMedida } from '../database/associations.js';
import { ApiError } from './ApiError.js';

// `Existencia` (el cache de saldo) no sabe de unidades — guarda un único
// número por (almacén, artículo), implícitamente en la unidad base del
// artículo (Articulo.unidadMedidaId). Cualquier movimiento/consumo que se
// registre en OTRA unidad (ej. la mezcla mide en ml pero el artículo lleva
// su stock en L) tiene que convertirse a esa unidad base ANTES de tocar el
// saldo — si no, el descuento queda equivocado en silencio (ej. un factor
// de 1000x entre ml y L).
//
// Mismo algoritmo BFS que usa la calculadora de conversión del frontend
// (app-corbana .../inventarios/unidades/page.js): las conversiones
// registradas en `unidad_conversiones` son un grafo BIDIRECCIONAL (cada
// fila origen→destino también habilita destino→origen con el factor
// inverso) y se puede resolver un camino aunque no exista una conversión
// DIRECTA entre las dos unidades (ej. ml→L→Ton encadenado).

// BFS: la primera vez que se llega al destino ya es el camino más corto
// (menos conversiones encadenadas — más confiable numéricamente que
// acumular por un camino más largo).
export async function resolverFactorConversion(unidadOrigenId, unidadDestinoId, { transaction } = {}) {
  if (unidadOrigenId === unidadDestinoId) return 1;

  const filas = await UnidadConversion.findAll({ transaction });
  const grafo = new Map();
  const agregarArista = (desde, hasta, factor) => {
    if (!grafo.has(desde)) grafo.set(desde, []);
    grafo.get(desde).push({ hasta, factor });
  };
  for (const c of filas) {
    const factor = Number(c.factor);
    agregarArista(c.unidadOrigenId, c.unidadDestinoId, factor);
    agregarArista(c.unidadDestinoId, c.unidadOrigenId, 1 / factor);
  }

  const visitados = new Set([unidadOrigenId]);
  const cola = [{ id: unidadOrigenId, factorAcumulado: 1 }];
  while (cola.length) {
    const { id, factorAcumulado } = cola.shift();
    for (const { hasta, factor } of grafo.get(id) || []) {
      if (visitados.has(hasta)) continue;
      const nuevoFactor = factorAcumulado * factor;
      if (hasta === unidadDestinoId) return nuevoFactor;
      visitados.add(hasta);
      cola.push({ id: hasta, factorAcumulado: nuevoFactor });
    }
  }
  return null;
}

// Convierte `cantidad` (medida en `unidadId`) a la unidad base del
// `articulo` (articulo.unidadMedidaId) — llamar SIEMPRE antes de
// assertStockSuficiente()/registrarMovimientoEnCache() cuando la cantidad
// pueda venir en una unidad distinta a la del artículo (mezclas,
// movimientos manuales). Si no se indicó unidad, o el artículo no tiene
// unidad base definida, o coinciden, no hay nada que convertir — se
// devuelve la cantidad tal cual (mismo comportamiento que antes de que
// existiera esta función, para no romper artículos sin unidad configurada).
// Si se indicó una unidad distinta y no hay forma de convertirla (directa
// o encadenada), bloquea con un error claro — mejor eso que descontar
// inventario con el número equivocado en silencio.
export async function convertirACantidadBase(articulo, unidadId, cantidad, { transaction } = {}) {
  const cantidadNum = Number(cantidad);
  if (!unidadId || !articulo?.unidadMedidaId || unidadId === articulo.unidadMedidaId) return cantidadNum;

  const factor = await resolverFactorConversion(unidadId, articulo.unidadMedidaId, { transaction });
  if (factor === null) {
    const [unidad, unidadBase] = await Promise.all([
      UnidadMedida.findByPk(unidadId, { transaction }),
      UnidadMedida.findByPk(articulo.unidadMedidaId, { transaction }),
    ]);
    throw ApiError.badRequest(
      `No hay conversión registrada entre ${unidad?.codigo || 'la unidad elegida'} y ${unidadBase?.codigo || 'la unidad base'} del artículo "${articulo.nombre}" — agrégala en Unidades de Medida.`,
    );
  }
  return cantidadNum * factor;
}

export default { resolverFactorConversion, convertirACantidadBase };
