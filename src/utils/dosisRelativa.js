import { Articulo, MezclaComponente, UnidadMedida } from '../database/associations.js';
import { ApiError } from './ApiError.js';
import { convertirACantidadBase, resolverFactorConversion } from './unidadConversion.js';

export const TIPOS_DOSIS = ['FIJA', 'PORCENTAJE', 'POR_VOLUMEN', 'POR_LITRO_AGUA'];

// Dosis relativa entre insumos de una misma receta de mezcla. Tres tipos
// (excluyentes):
// - PORCENTAJE: el renglón es el X% de OTRO artículo de la receta (ej.
//   HIPOTENSOR SYS = 1% del ACEITE BANOLE). % sobre la cantidad FÍSICA (con
//   conversión de unidades). Como todos los renglones se escalan juntos
//   después, resolverlo a nivel de receta equivale a "X% del otro insumo"
//   en cada etapa. La `cantidad` guardada queda siempre RESUELTA.
// - POR_VOLUMEN: tasa por unidad de volumen de mezcla TOTAL preparada (ej.
//   ANTIFOAM = 1 g por galón — la tasa va en la unidad del renglón y
//   tasaUnidadId dice por cada cuánto volumen). Se resuelve con el total a
//   preparar en cada aspersión (no con la receta); en la receta solo queda
//   un estimado (tasa × total de referencia) para costos/vistas.
// - POR_LITRO_AGUA: tasa por litro de AGUA de la preparación (ej.
//   ACONDICIONADOR = 0.3 g/L — la tasa va en la unidad del renglón, el
//   denominador siempre es el Litro). Se resuelve con el agua de cada
//   aspersión; en la receta solo queda un estimado.
//
// Diseño: ningún lector (detalle, snapshots de aspersión, descuentos de
// stock, app móvil) tiene que saber de reglas — todos ven cantidades
// correctas.

// Normaliza la regla que trae el payload. Devuelve { tipoDosis,
// referenciaArticuloUuid, porcentajeReferencia, tasa, tasaUnidadUuid }.
export function normalizarReglaDosisRelativa(comp) {
  const tipo = comp.tipoDosis || (comp.referenciaArticuloUuid ? 'PORCENTAJE' : 'FIJA');
  if (!TIPOS_DOSIS.includes(tipo)) throw ApiError.badRequest(`Tipo de dosis "${tipo}" no válido`);
  if (tipo === 'POR_VOLUMEN') {
    const tasa = Number(comp.tasa);
    if (!Number.isFinite(tasa) || tasa <= 0) {
      throw ApiError.badRequest('La dosis por volumen exige una tasa mayor a 0');
    }
    if (!comp.unidadUuid) {
      throw ApiError.badRequest('La dosis por volumen exige unidad en el renglón (la tasa va en esa unidad)');
    }
    if (!comp.tasaUnidadUuid) {
      throw ApiError.badRequest('La dosis por volumen exige la unidad de volumen de referencia (por galón, por litro, ...)');
    }
    return { tipoDosis: tipo, referenciaArticuloUuid: null, porcentajeReferencia: null, tasa, tasaUnidadUuid: comp.tasaUnidadUuid };
  }
  if (tipo === 'POR_LITRO_AGUA') {
    const tasa = Number(comp.tasa);
    if (!Number.isFinite(tasa) || tasa <= 0) {
      throw ApiError.badRequest('La dosis por litro de agua exige una tasa mayor a 0');
    }
    if (!comp.unidadUuid) {
      throw ApiError.badRequest('La dosis por litro de agua exige unidad en el renglón (la tasa va en esa unidad)');
    }
    return { tipoDosis: tipo, referenciaArticuloUuid: null, porcentajeReferencia: null, tasa, tasaUnidadUuid: null };
  }
  if (tipo === 'PORCENTAJE') {
    const refUuid = comp.referenciaArticuloUuid || null;
    const pct = comp.porcentajeReferencia ?? null;
    if (!refUuid && (pct === null || pct === '')) {
      return { tipoDosis: 'FIJA', referenciaArticuloUuid: null, porcentajeReferencia: null, tasa: null, tasaUnidadUuid: null };
    }
    if (!refUuid || pct === null || pct === '') {
      throw ApiError.badRequest('La dosis relativa exige artículo de referencia Y porcentaje juntos');
    }
    const porcentaje = Number(pct);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0) {
      throw ApiError.badRequest('El porcentaje de la dosis relativa debe ser mayor a 0');
    }
    return { tipoDosis: tipo, referenciaArticuloUuid: refUuid, porcentajeReferencia: porcentaje, tasa: null, tasaUnidadUuid: null };
  }
  return { tipoDosis: 'FIJA', referenciaArticuloUuid: null, porcentajeReferencia: null, tasa: null, tasaUnidadUuid: null };
}

// Valida las reglas contra la lista COMPLETA de renglones de la versión
// (payload o filas guardadas). PORCENTAJE: la referencia debe ser otro
// artículo de la receta (no el mismo renglón), sin ciclos A→B→A, y con
// unidades convertibles. POR_VOLUMEN: la unidad de la tasa debe ser de
// volumen. POR_LITRO_AGUA: sin validación cruzada (tasa y unidad ya vistas
// en normalizar). `filas`: [{ uuid?, articuloUuid, unidadUuid?, tipoDosis?,
///  referenciaArticuloUuid?, porcentajeReferencia?, tasa?, tasaUnidadUuid? }]
export async function validarReglasDosisRelativa(filas, { transaction } = {}) {
  const porArticulo = new Map();
  filas.forEach((f, i) => {
    if (!porArticulo.has(f.articuloUuid)) porArticulo.set(f.articuloUuid, []);
    porArticulo.get(f.articuloUuid).push(i);
  });

  const refDe = new Map(); // indice fila seguidora -> indice fila referencia
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    if (f.tipoDosis !== 'PORCENTAJE' || !f.referenciaArticuloUuid) continue;
    const candidatos = porArticulo.get(f.referenciaArticuloUuid) || [];
    // Otro renglón con ese artículo (si el único es él mismo, no vale).
    const j = candidatos.find((k) => k !== i && filas[k].uuid !== f.uuid);
    const refIdx = j !== undefined ? j : candidatos.find((k) => k !== i);
    if (refIdx === undefined) {
      throw ApiError.badRequest('La dosis relativa debe apuntar a OTRO insumo de la misma receta');
    }
    refDe.set(i, refIdx);
  }

  // Ciclos (A% de B y B% de A, o cadenas más largas).
  for (const inicio of refDe.keys()) {
    const vistos = new Set([inicio]);
    let actual = refDe.get(inicio);
    while (refDe.has(actual)) {
      if (vistos.has(actual)) throw ApiError.badRequest('Las dosis relativas no pueden formar un ciclo (A% de B y B% de A)');
      vistos.add(actual);
      actual = refDe.get(actual);
    }
  }

  // Convertibilidad de unidades (se resuelve artículo→id y unidad→id acá
  // para no repetir lookups después — el resultado se reusa en resolver).
  const resueltas = [];
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const articulo = await Articulo.findOne({ where: { uuid: f.articuloUuid }, transaction });
    if (!articulo) throw ApiError.notFound('Artículo no encontrado');
    // Solo el Agua nunca lleva regla (rellena el total); el ACONDICIONADOR
    // admite POR_LITRO_AGUA (o queda en el 0.8 legacy).
    if (articulo.nombre === 'Agua' && f.tipoDosis && f.tipoDosis !== 'FIJA') {
      throw ApiError.badRequest('"Agua" completa el total y no admite regla de dosis');
    }
    let unidadId = null;
    if (f.unidadUuid) {
      const unidad = await UnidadMedida.findOne({ where: { uuid: f.unidadUuid }, transaction });
      if (!unidad) throw ApiError.notFound('Unidad de medida no encontrada');
      unidadId = unidad.id;
    }
    let tasaUnidadId = null;
    if (f.tipoDosis === 'POR_VOLUMEN') {
      const tasaUnidad = await UnidadMedida.findOne({ where: { uuid: f.tasaUnidadUuid }, transaction });
      if (!tasaUnidad) throw ApiError.notFound('Unidad de volumen de la tasa no encontrada');
      if (tasaUnidad.tipo !== 'VOLUMEN') {
        throw ApiError.badRequest(`La unidad de la tasa ("${tasaUnidad.nombre}") debe ser de volumen (por galón, por litro, ...)`);
      }
      tasaUnidadId = tasaUnidad.id;
    }
    resueltas.push({ ...f, articuloId: articulo.id, unidadId, tasaUnidadId });
  }
  for (const [i, j] of refDe.entries()) {
    const seguidor = resueltas[i];
    const referencia = resueltas[j];
    if (seguidor.unidadId && referencia.unidadId && seguidor.unidadId !== referencia.unidadId) {
      const factor = await resolverFactorConversion(referencia.unidadId, seguidor.unidadId, { transaction });
      if (factor === null) {
        throw ApiError.badRequest(
          `No hay conversión registrada entre la unidad del insumo de referencia y la del insumo relativo — agrégala en Unidades de Medida.`,
        );
      }
    }
    seguidor.referenciaArticuloId = referencia.articuloId;
  }
  return { filas: resueltas, refDe };
}

// Resuelve las cantidades efectivas. PORCENTAJE: topológico (acepta
// cadenas A% de B, B% de C). POR_VOLUMEN: tasa × total de referencia
// llevado a la unidad de la tasa (`totalRef = { cantidad, unidadId }`, ej.
// rendimiento con su unidad al guardar la receta, total a preparar en cada
// aspersión); si no hay total de referencia se conserva la cantidad del
// payload. Recibe la salida de validarReglasDosisRelativa. Devuelve las
// filas con `cantidad` resuelta (número).
export async function resolverCantidadesRelativas(validadas, { transaction, totalRef = null } = {}) {
  const { filas, refDe } = validadas;
  const cantidades = filas.map((f) => Number(f.cantidad));
  const resuelto = new Array(filas.length).fill(false);

  const resolver = async (i, pila = []) => {
    if (resuelto[i]) return cantidades[i];
    if (pila.includes(i)) throw ApiError.badRequest('Las dosis relativas no pueden formar un ciclo (A% de B y B% de A)');
    const seguidor = filas[i];
    if (seguidor.tipoDosis === 'POR_VOLUMEN') {
      // Estimado de receta (en la unidad del renglón): la cantidad exacta
      // se calcula con el total a preparar en cada aspersión.
      if (totalRef !== null && totalRef !== undefined && Number(totalRef.cantidad) > 0 && totalRef.unidadId) {
        const factor =
          totalRef.unidadId === seguidor.tasaUnidadId
            ? 1
            : await resolverFactorConversion(totalRef.unidadId, seguidor.tasaUnidadId, { transaction });
        if (factor !== null) cantidades[i] = totalRef.cantidad * factor * Number(seguidor.tasa);
      }
      resuelto[i] = true;
      return cantidades[i];
    }
    const j = refDe.get(i);
    if (j === undefined) {
      resuelto[i] = true;
      return cantidades[i];
    }
    const cantidadRef = await resolver(j, [...pila, i]);
    const referencia = filas[j];
    let enUnidadSeguidor = cantidadRef;
    if (seguidor.unidadId && referencia.unidadId && seguidor.unidadId !== referencia.unidadId) {
      const factor = await resolverFactorConversion(referencia.unidadId, seguidor.unidadId, { transaction });
      enUnidadSeguidor = factor === null ? cantidadRef : cantidadRef * factor;
    }
    cantidades[i] = enUnidadSeguidor * (Number(seguidor.porcentajeReferencia) / 100);
    resuelto[i] = true;
    return cantidades[i];
  };

  for (let i = 0; i < filas.length; i++) await resolver(i);
  return filas.map((f, i) => ({ ...f, cantidad: cantidades[i] }));
}

// Recalcula y persiste los seguidores de una versión (tras editar la
// cantidad/unidad de una referencia con actualizarComponente). Actualiza
// `cantidad` + snapshots de costo de los seguidores que cambien y devuelve
// las filas finales para recalcular totales de la versión.
export async function propagarDosisRelativas(mezclaVersionId, { transaction } = {}) {
  const filas = await MezclaComponente.findAll({ where: { mezclaVersionId }, transaction });
  if (!filas.some((f) => f.referenciaArticuloId)) return filas;

  const porArticulo = new Map();
  for (const f of filas) {
    if (!porArticulo.has(f.articuloId)) porArticulo.set(f.articuloId, []);
    porArticulo.get(f.articuloId).push(f);
  }
  const cantidades = new Map(filas.map((f) => [f.id, Number(f.cantidad)]));
  const resuelto = new Set();

  const resolver = async (fila, pila = []) => {
    if (resuelto.has(fila.id)) return cantidades.get(fila.id);
    if (!fila.referenciaArticuloId) {
      resuelto.add(fila.id);
      return cantidades.get(fila.id);
    }
    if (pila.includes(fila.id)) return cantidades.get(fila.id);
    const ref = (porArticulo.get(fila.referenciaArticuloId) || []).find((c) => c.id !== fila.id);
    if (!ref) {
      resuelto.add(fila.id);
      return cantidades.get(fila.id);
    }
    const cantidadRef = await resolver(ref, [...pila, fila.id]);
    let enUnidadSeguidor = cantidadRef;
    if (fila.unidadId && ref.unidadId && fila.unidadId !== ref.unidadId) {
      const factor = await resolverFactorConversion(ref.unidadId, fila.unidadId, { transaction });
      if (factor !== null) enUnidadSeguidor = cantidadRef * factor;
    }
    const nueva = enUnidadSeguidor * (Number(fila.porcentajeReferencia) / 100);
    cantidades.set(fila.id, nueva);
    resuelto.add(fila.id);
    return nueva;
  };

  for (const f of filas) await resolver(f);

  for (const f of filas) {
    const nueva = cantidades.get(f.id);
    if (Math.abs(nueva - Number(f.cantidad)) < 1e-9) continue;
    const articulo = await Articulo.findByPk(f.articuloId, { transaction });
    const cantidadBase = await convertirACantidadBase(articulo, f.unidadId, nueva, { transaction });
    await f.update(
      {
        cantidad: nueva,
        costoTotalSnapshot: Number(articulo?.costoCompra || 0) * cantidadBase,
      },
      { transaction },
    );
  }
  return MezclaComponente.findAll({ where: { mezclaVersionId }, transaction });
}
