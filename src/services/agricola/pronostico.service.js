import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
import { Finca, Semana } from '../../database/associations.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { semanaRepository } from '../../repositories/agricola/semana.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { getFincaIdsPermitidas } from '../../utils/fincaScope.js';
import { logger } from '../../utils/logger.js';

// Tabla de cuantiles de error histórico (5%/95%) por horizonte, generada por
// `scripts/generar-cuantiles-error.mjs` y validada contra un período de
// holdout (ver esa validación en el propio script) — se carga una vez al
// iniciar el proceso, NO se recalcula por request (recalcularla exigiría
// re-correr el backtest completo, carísimo para un request en vivo). Debe
// regenerarse periódicamente (ej. trimestral) a medida que se acumula más
// historia real; mientras tanto sigue siendo válida, solo menos precisa.
const CUANTILES_ERROR_PATH = fileURLToPath(new URL('./pronostico.errorQuantiles.json', import.meta.url));
let cuantilesError = null;
try {
  cuantilesError = JSON.parse(readFileSync(CUANTILES_ERROR_PATH, 'utf8'));
} catch (err) {
  logger.warn(`Pronóstico: no se pudo cargar ${CUANTILES_ERROR_PATH} (${err.message}) — IC quedará null hasta regenerarla con scripts/generar-cuantiles-error.mjs`);
}

// Ventana de edad fija para v1 (sin catálogo de restricciones de corte por
// finca todavía): la política de la empresa solo permite cortar hasta los 12
// semanas de edad — un racimo embolsado en la semana E se considera
// cosechable entre E+7 y E+11 semanas después (edades 8 a 12). Confirmado
// contra 18 meses de datos reales: edad 13+ es prácticamente inexistente
// (387 de 4.36M racimos, ~0.01%) — cuando aparece es excepción o error de
// captura, no debe alimentar la tasa histórica del pronóstico.
const EDADES = [8, 9, 10, 11, 12];
const EDAD_MAX = EDADES[EDADES.length - 1];
// Ventana "reciente": semanas hacia atrás para tener suficientes cohortes ya
// cerradas (todas sus edades transcurridas) con las que calcular la tasa
// reciente por edad y el ratio de las últimas semanas reales.
const RECIENTE_LOOKBACK = EDAD_MAX + 20;
// Corte duro deliberado, no un descuido: se probó reemplazarlo por shrinkage
// empírico (Bühlmann-Straub) y también por un β fijo muy grande ("casi 100%
// tasa global") — ver PLAN.md y el historial de esta sesión. Ambas variantes
// mejoraban notablemente el MAPE/Bias en la ventana de ajuste (2024-07 a
// 2026-05), pero al validar contra un período histórico independiente
// (2023-06 a 2024-06, nunca usado durante el ajuste) el resultado se
// revertía o quedaba mixto — la "mejora" era sobreajuste al período de
// prueba, no una mejora real y generalizable. Se conserva este corte duro
// hasta tener más historia real acumulada o una validación cruzada temporal
// propiamente construida (varias ventanas, no 2 elegidas a mano).
const MIN_COHORTES_FINCA = 5;
const SEMANAS_RATIO = 8;
const MIN_SEMANAS_RATIO_FINCA = 3;
// Componente "estacional": además de la tendencia reciente, se compara la
// MISMA semana del calendario (numero_semana) en años anteriores — el ratio
// y el aprovechamiento se calculan combinando (promedio simple) ambas
// señales, no solo la reciente.
const ANIOS_ESTACIONAL = 3;
const TOLERANCIA_SEMANA_ESTACIONAL = 1;
// Ventana total a traer de la base de datos: la reciente + los años de
// comparación estacional + margen — en una sola consulta, no una por año.
const SEMANAS_LOOKBACK_FETCH = 53 * ANIOS_ESTACIONAL + RECIENTE_LOOKBACK + 5;

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;
const toISODate = (date) => date.toISOString().slice(0, 10);

// Holt-Winters aditivo para el Ratio (cajas/racimo) — sustituye el blend fijo
// 50/50 reciente+estacional SOLO cuando hay suficiente historial real propio
// (ver HW_MIN_SEMANAS); si no, cae al blend original sin cambios. Período
// estacional = 52 (semana 53 se pliega sobre el bucket 52 — ver faseSemana).
//
// ESTADO: implementado y correcto, pero DESACTIVADO por defecto
// (HW_EXPERIMENTO_ACTIVO=false) — evaluado con backtest y a propósito no
// promovido a línea base todavía. El seguimiento operativo real (no el
// calendario, que existe desde 2021) recién empieza el 2023-01-02 — con
// HW_MIN_SEMANAS=130, Holt-Winters solo puede activarse para asOfDate desde
// ~2025-08 en adelante, lo que deja UNA sola ventana de evaluación
// disponible (2025-08 a 2026-05, 10 fechas asOfDate, N=40 por horizonte) en
// vez de las múltiples ventanas independientes que este proyecto exige antes
// de adoptar un cambio (ver nota de MIN_COHORTES_FINCA — shrinkage/pooling
// se descartaron tras 11 ventanas de validación cruzada). En esa única
// ventana el patrón es consistente pero mixto: MAPE y Bias mejoran
// claramente a 1-4 semanas (Bias -13%→-5% aprox.), pero el MAPE empeora
// fuerte a 8-12 semanas (16%→30% en 12 semanas) mientras el Bias sigue
// mejorando — probablemente el componente de tendencia compone error al
// extrapolar más lejos. Con una sola ventana no alcanza el estándar de
// evidencia ya aplicado a cada otra decisión de este archivo — se deja el
// toggle listo para revisitar cuando haya una segunda ventana madura
// disponible (aprox. mediados de 2026), en vez de borrar el trabajo.
const HW_M = 52;
// 2 ciclos completos (104 semanas) para inicializar nivel/tendencia/
// estacionalidad + margen para que el grid search de α/β/γ tenga suficientes
// residuos post-inicialización con los que comparar configuraciones.
const HW_MIN_SEMANAS = Math.ceil(2.5 * HW_M);
const HW_GRID = [0.1, 0.3, 0.5, 0.7, 0.9];
// Toggle de experimento para el backtest A/B (paso 5 del plan de rigor
// estadístico) — con esto en false (default), el comportamiento es idéntico
// al blend 50/50 ya validado; se activa solo para comparar en
// scripts/backtest-pronostico.mjs (PRONOSTICO_EXPERIMENTO_HW=1). Ver nota
// de estado arriba antes de considerar activarlo por defecto.
const HW_EXPERIMENTO_ACTIVO = process.env.PRONOSTICO_EXPERIMENTO_HW === '1';

// Intervalos de confianza por bootstrap no paramétrico: B=200 réplicas da
// una granularidad de percentil de 0.5% para un IC del 90% (percentiles 5 y
// 95 de 200 valores ordenados), suficientemente estable sin ser costoso
// (Efron) — ver plan de rigor estadístico.
const BOOTSTRAP_B = 200;

// PRNG determinístico (mulberry32) — no necesita ser criptográfico, solo
// reproducible dentro de un mismo request. Semilla fija arbitraria.
function crearRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function resolveFincas(fincaUuidsCsv, user) {
  const permitidas = getFincaIdsPermitidas(user); // null = sin restricción
  const where = { estado: true };
  if (fincaUuidsCsv) {
    const uuids = fincaUuidsCsv.split(',').map((s) => s.trim()).filter(Boolean);
    if (uuids.length === 0) throw ApiError.badRequest('fincaUuids no puede estar vacío');
    where.uuid = { [Op.in]: uuids };
  } else if (permitidas !== null) {
    where.id = { [Op.in]: permitidas };
  }
  let fincas = await Finca.findAll({ where, attributes: ['id', 'uuid', 'codigo', 'nombre'], order: [['nombre', 'ASC']] });
  if (permitidas !== null) {
    const permitidasSet = new Set(permitidas);
    fincas = fincas.filter((f) => permitidasSet.has(f.id));
  }
  if (fincas.length === 0) throw ApiError.notFound('No hay fincas disponibles para esa selección');
  return fincas;
}

async function resolveSemanaInicio(semanaInicioUuid, asOfDate) {
  const semana = semanaInicioUuid
    ? await Semana.findOne({ where: { uuid: semanaInicioUuid } })
    : await semanaRepository.findByFecha(toISODate(asOfDate));
  if (!semana) {
    throw ApiError.notFound('No se encontró la semana inicial (o no hay una semana registrada para la fecha actual)');
  }
  return semana;
}

// Hace todo el trabajo pesado una sola vez — getPronostico y
// exportPronosticoToExcel comparten este cálculo. `asOfDate` solo lo usa el
// backtesting harness (scripts/backtest-pronostico.mjs) para simular "hoy"
// en el pasado y comparar la proyección contra lo que realmente pasó — la
// API en vivo siempre llama sin este argumento (default = ahora mismo).
async function computeForecast(query, user, asOfDate = new Date()) {
  const fincas = await resolveFincas(query.fincaUuids, user);
  const semanaInicio = await resolveSemanaInicio(query.semanaInicioUuid, asOfDate);
  const semanasCount = query.semanas ? Number(query.semanas) : 8;
  const pctNoCosechadoOverride =
    query.pctNoCosechado !== undefined && query.pctNoCosechado !== '' && query.pctNoCosechado !== null
      ? Number(query.pctNoCosechado)
      : null;

  const hoy = await semanaRepository.findByFecha(toISODate(asOfDate));
  if (!hoy) {
    throw ApiError.notFound('No hay una semana de calendario registrada para la fecha actual — revisa el calendario de semanas.');
  }

  // Ventana completa de semanas (lookback + proyección) en una sola
  // consulta, ordenada por fecha real — el id de semana solo refleja el
  // orden en que se creó cada fila, no el orden cronológico.
  const inicioFecha = new Date(semanaInicio.fechaInicio);
  const desdeFecha = toISODate(new Date(inicioFecha.getTime() - SEMANAS_LOOKBACK_FETCH * MS_POR_SEMANA));
  const hastaFecha = toISODate(new Date(inicioFecha.getTime() + (semanasCount - 1) * MS_POR_SEMANA));
  const semanas = await Semana.findAll({
    where: { fechaInicio: { [Op.gte]: desdeFecha, [Op.lte]: hastaFecha } },
    attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'],
    order: [['fechaInicio', 'ASC']],
    raw: true,
  });
  const startIdx = semanas.findIndex((s) => s.id === semanaInicio.id);
  if (startIdx === -1) {
    throw ApiError.notFound('La semana inicial no tiene suficiente historial de semanas alrededor para proyectar');
  }
  const semanaIds = semanas.map((s) => s.id);

  // Si el calendario de semanas (Maestros > Semanas) no tiene generado el
  // año siguiente, la ventana solicitada se corta antes de completar
  // `semanasCount` — sin este aviso, un usuario con varias fincas
  // seleccionadas puede confundir el corte con que "se repiten las
  // semanas" (cada finca vuelve a arrancar en la misma última semana
  // disponible en vez de seguir avanzando).
  const semanasDisponibles = Math.max(0, Math.min(semanasCount, semanas.length - startIdx));
  const calendarioIncompleto = semanasDisponibles < semanasCount;
  const ultimaSemanaDisponible = semanas[semanas.length - 1];

  // Alcance de fincas para las 3 consultas: el permiso completo del usuario
  // (no solo las seleccionadas), para poder calcular una tasa "global" de
  // respaldo sin filtrar de más ni revelar datos fuera de su permiso.
  const scopeFincaIds = getFincaIdsPermitidas(user); // null = sin restricción

  const [embolseMap, cosechadoMap, cajasMap, cohorteCosechadoRows] = await Promise.all([
    racimoMovimientoRepository.getEmbolsePorFincaYSemana({ fincaIds: scopeFincaIds, semanaEmbolseIds: semanaIds }),
    racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds: scopeFincaIds, semanaRegistroIds: semanaIds }),
    produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds: scopeFincaIds, semanaIds }),
    racimoMovimientoRepository.getCosechadoPorFincaCohorte({ fincaIds: scopeFincaIds, semanaEmbolseIds: semanaIds }),
  ]);

  const embolse = (fincaId, idx) =>
    idx < 0 || idx >= semanas.length ? 0 : embolseMap.get(`${fincaId}-${semanas[idx].id}`) || 0;
  const cosechado = (fincaId, idx) =>
    idx < 0 || idx >= semanas.length ? 0 : cosechadoMap.get(`${fincaId}-${semanas[idx].id}`) || 0;
  const cajas = (fincaId, idx) =>
    idx < 0 || idx >= semanas.length ? 0 : cajasMap.get(`${fincaId}-${semanas[idx].id}`) || 0;
  // Suman sobre una lista de fincas — con una sola finca en la lista se
  // comportan igual que embolse/cosechado/cajas de arriba, así el mismo
  // código sirve tanto para un "grupo" de una finca como para el global.
  const embolseGrupo = (idList, idx) => idList.reduce((acc, fid) => acc + embolse(fid, idx), 0);
  const cosechadoGrupo = (idList, idx) => idList.reduce((acc, fid) => acc + cosechado(fid, idx), 0);
  const cajasGrupo = (idList, idx) => idList.reduce((acc, fid) => acc + cajas(fid, idx), 0);

  const esCerrada = (embolseIdx) => {
    const harvestIdxMax = embolseIdx + EDAD_MAX - 1;
    if (harvestIdxMax >= semanas.length) return false;
    return semanas[harvestIdxMax].fechaInicio <= hoy.fechaInicio;
  };
  const esReal = (idx) => semanas[idx].fechaInicio <= hoy.fechaInicio;
  // "Reciente" = dentro de las últimas RECIENTE_LOOKBACK semanas antes de la
  // semana de inicio (la ventana que se usaba antes de agregar estacional).
  const esReciente = (idx) => startIdx - idx >= 0 && startIdx - idx <= RECIENTE_LOOKBACK;
  // "Estacional" = misma semana del calendario (±1) que la semana de
  // inicio, pero de un año ANTERIOR — para comparar contra cómo se comportó
  // esa misma época en años pasados, no solo la tendencia de las últimas
  // semanas.
  const distanciaCircular = (a, b, mod = 53) => {
    const d = Math.abs(a - b) % mod;
    return Math.min(d, mod - d);
  };
  const numeroSemanaObjetivo = semanaInicio.numeroSemana;
  const esEstacional = (idx) =>
    semanas[idx].anio !== semanaInicio.anio &&
    distanciaCircular(semanas[idx].numeroSemana, numeroSemanaObjetivo) <= TOLERANCIA_SEMANA_ESTACIONAL;

  // Todas las fincas presentes en los mapas (alcance completo del usuario),
  // usadas para calcular la tasa "global" de respaldo.
  const fincaIdsConDatos = new Set();
  for (const key of embolseMap.keys()) fincaIdsConDatos.add(Number(key.split('-')[0]));
  for (const key of cosechadoMap.keys()) fincaIdsConDatos.add(Number(key.split('-')[0]));

  // Cada movimiento de corte/recuse ya trae su propia semana de embolse de
  // origen (`semanaEmbolseId`) — así que la edad real de cada cohorte se
  // calcula exacta (semanaRegistro − semanaEmbolse), en vez de repartir el
  // total cortado de una semana entre las 6 edades candidatas (eso
  // sobre-contaba: un mismo racimo cortado se sumaba una vez por cada
  // cohorte de embolse "candidata" que pudiera haberlo originado).
  const idxById = new Map(semanas.map((s, i) => [s.id, i]));
  const edadSet = new Set(EDADES);
  const cohortePorFinca = new Map(); // fincaId -> [{embolseIdx, edad, total}]
  for (const row of cohorteCosechadoRows) {
    const embolseIdx = idxById.get(row.semanaEmbolseId);
    const registroIdx = idxById.get(row.semanaRegistroId);
    if (embolseIdx === undefined || registroIdx === undefined) continue;
    const edad = registroIdx - embolseIdx + 1;
    if (!edadSet.has(edad)) continue;
    if (!cohortePorFinca.has(row.fincaId)) cohortePorFinca.set(row.fincaId, []);
    cohortePorFinca.get(row.fincaId).push({ embolseIdx, edad, total: row.total });
  }

  // Diagnóstico (NO exclusión): cohortes puntuales donde lo cosechado
  // registrado supera lo embolsado registrado para esa semana de embolse
  // exacta. Se probó excluir estas cohortes del cálculo (numerador Y
  // denominador) y el backtest (scripts/backtest-pronostico.mjs) demostró
  // que empeora la precisión real (MAPE +2 a +6 puntos, sesgo casi el doble
  // de negativo) — investigando la causa, el agregado ANUAL de estas mismas
  // fincas (ej. María Margarita/Marbella) está sano (ratio 0.93-0.98,
  // siempre <1), y el problema aparece solo en 2-3 semanas puntuales por
  // año. Eso es la firma de un error de captura de "semana de embolse"
  // (un movimiento mal atribuido a la semana vecina), no de dato faltante —
  // se compensa solo al agregar suficientes cohortes, y excluirlo bota señal
  // real de una semana sin botar el déficit correspondiente en otra. Se deja
  // solo como diagnóstico visible en meta; el mecanismo real de corrección
  // es el clamp agregado de `tasasPorFinca` de abajo, que sí mejora el MAPE.
  const cosechadoPorCohorte = new Map(); // `${fincaId}-${embolseIdx}` -> total (todas las edades)
  for (const [fincaId, entries] of cohortePorFinca) {
    for (const { embolseIdx, total } of entries) {
      const key = `${fincaId}-${embolseIdx}`;
      cosechadoPorCohorte.set(key, (cosechadoPorCohorte.get(key) || 0) + total);
    }
  }
  const cohortesAnomalas = new Set();
  const fincasConCohortesAnomalas = new Set();
  for (const [key, totalCosechado] of cosechadoPorCohorte) {
    const [fincaId, embolseIdx] = key.split('-').map(Number);
    if (!esCerrada(embolseIdx)) continue;
    if (totalCosechado > embolse(fincaId, embolseIdx)) {
      cohortesAnomalas.add(key);
      fincasConCohortesAnomalas.add(fincaId);
    }
  }

  // Cuenta cuántas veces se activó el clamp de `tasasPorFinca` — se expone
  // en meta para diagnóstico.
  let clampsAplicados = 0;

  // rawRate[edad] = proporción histórica de un embolse que termina
  // cosechada a esa edad, agregada sobre cohortes ya cerradas de las fincas
  // en `fincaIdList` que además cumplen `filtro` (reciente o estacional).
  function tasasPorFinca(fincaIdList, filtro) {
    let denomEmbolse = 0;
    let cohortesCerradas = 0;
    for (let embolseIdx = 0; embolseIdx < semanas.length; embolseIdx++) {
      if (!esCerrada(embolseIdx)) continue;
      if (filtro && !filtro(embolseIdx)) continue;
      let eTotal = 0;
      for (const fincaId of fincaIdList) eTotal += embolse(fincaId, embolseIdx);
      if (eTotal <= 0) continue;
      cohortesCerradas++;
      denomEmbolse += eTotal;
    }
    const numCosechado = Object.fromEntries(EDADES.map((e) => [e, 0]));
    for (const fincaId of fincaIdList) {
      for (const { embolseIdx, edad, total } of cohortePorFinca.get(fincaId) || []) {
        if (!esCerrada(embolseIdx)) continue;
        if (filtro && !filtro(embolseIdx)) continue;
        numCosechado[edad] += total;
      }
    }
    const rawRate = {};
    for (const edad of EDADES) rawRate[edad] = denomEmbolse > 0 ? numCosechado[edad] / denomEmbolse : 0;
    // Mecanismo real de corrección (ver nota extensa arriba de por qué NO se
    // excluyen cohortes puntuales): cosechar más de lo que se embolsó es
    // matemáticamente imposible en el AGREGADO (sumaRate > 1) — un
    // aprovechamiento real de 98-100% es plausible y no debe recortarse; solo
    // se corrige cuando el agregado completo de todas las edades lo viola.
    const pctNoCosechado = denomEmbolse > 0 ? aplicarClampSeguridad(rawRate) : null;
    return { rawRate, pctNoCosechado, cohortesCerradas, numCosechado, denomEmbolse };
  }

  // Aplica el clamp de seguridad (ver nota junto a TOPE_SUMA_RATE en
  // tasasPorFinca) a una curva de tasas ya armada, sea cual sea su origen.
  function aplicarClampSeguridad(rawRate) {
    let sumaRate = EDADES.reduce((acc, e) => acc + rawRate[e], 0);
    const TOPE_SUMA_RATE = 0.999;
    if (sumaRate > TOPE_SUMA_RATE) {
      const factor = TOPE_SUMA_RATE / sumaRate;
      for (const edad of EDADES) rawRate[edad] *= factor;
      sumaRate = TOPE_SUMA_RATE;
      clampsAplicados++;
    }
    return Math.max(0, Math.min(1, 1 - sumaRate));
  }

  // Combina la tasa reciente (últimas semanas) con la estacional (misma
  // semana del calendario en años anteriores) — promedio simple cuando hay
  // ambas señales; si falta una, usa solo la que exista.
  //
  // NOTA — probado y descartado por falta de generalización (ver también el
  // comentario de MIN_COHORTES_FINCA más arriba): se intentó (a) sumar los
  // cohortes de reciente+estacional en un pool antes de dividir, en vez de
  // promediar las dos tasas ya calculadas, y (b) reemplazar el corte duro de
  // abajo por shrinkage empírico (Bühlmann-Straub) hacia la tasa global,
  // incluso con β fijo llevado al extremo ("casi 100% tasa global"). Ambos
  // cambios mejoraban notablemente el MAPE/Bias en la ventana de ajuste
  // (2024-07 a 2026-05), pero al validar contra 2023-06 a 2024-06 (un
  // período nunca usado durante el ajuste) el resultado se revertía o
  // quedaba mixto — sobreajuste al período de prueba, no una mejora real.
  // Revisitar solo con más historia real acumulada o una validación cruzada
  // temporal propiamente construida (varias ventanas, no 2 elegidas a mano).
  function tasasBlend(fincaIdList) {
    const reciente = tasasPorFinca(fincaIdList, esReciente);
    const estacional = tasasPorFinca(fincaIdList, esEstacional);
    const tieneReciente = reciente.cohortesCerradas > 0;
    const tieneEstacional = estacional.cohortesCerradas > 0;
    const rawRate = {};
    for (const edad of EDADES) {
      if (tieneReciente && tieneEstacional) rawRate[edad] = (reciente.rawRate[edad] + estacional.rawRate[edad]) / 2;
      else if (tieneReciente) rawRate[edad] = reciente.rawRate[edad];
      else if (tieneEstacional) rawRate[edad] = estacional.rawRate[edad];
      else rawRate[edad] = 0;
    }
    const pctNoCosechado = aplicarClampSeguridad(rawRate);
    return {
      rawRate,
      pctNoCosechado,
      cohortesCerradas: reciente.cohortesCerradas + estacional.cohortesCerradas,
      usoEstacional: tieneEstacional,
    };
  }

  // El respaldo "global" (cuando una finca no tiene historial propio
  // suficiente) usa toda la ventana traída (reciente + años estacionales),
  // sin filtrar por semana — ya es un promedio amplio de último recurso.
  const global = tasasPorFinca([...fincaIdsConDatos]);

  // --- Bootstrap: unidad de remuestreo = cohorte completo (semana de
  // embolse), nunca racimos individuales (no son observaciones
  // independientes dentro de un cohorte). Mismo filtro que tasasPorFinca,
  // solo que en vez de sumar directo devuelve la lista de cohortes para
  // poder remuestrearla con reemplazo.
  function listaCohortesRate(fincaIdList, filtro) {
    const lista = [];
    for (let embolseIdx = 0; embolseIdx < semanas.length; embolseIdx++) {
      if (!esCerrada(embolseIdx)) continue;
      if (filtro && !filtro(embolseIdx)) continue;
      let eTotal = 0;
      for (const fincaId of fincaIdList) eTotal += embolse(fincaId, embolseIdx);
      if (eTotal <= 0) continue;
      lista.push({ embolseIdx, eTotal, cosechadoPorEdad: Object.fromEntries(EDADES.map((e) => [e, 0])) });
    }
    const idxEnLista = new Map(lista.map((c, i) => [c.embolseIdx, i]));
    for (const fincaId of fincaIdList) {
      for (const { embolseIdx, edad, total } of cohortePorFinca.get(fincaId) || []) {
        if (!esCerrada(embolseIdx)) continue;
        if (filtro && !filtro(embolseIdx)) continue;
        const i = idxEnLista.get(embolseIdx);
        if (i !== undefined) lista[i].cosechadoPorEdad[edad] += total;
      }
    }
    return lista;
  }

  // Recorta una curva de tasas sin contar en `clampsAplicados` (ese contador
  // es diagnóstico del punto estimado, no de las réplicas de bootstrap).
  function clampSinContar(rawRate) {
    const suma = EDADES.reduce((acc, e) => acc + rawRate[e], 0);
    if (suma > 0.999) {
      const factor = 0.999 / suma;
      for (const edad of EDADES) rawRate[edad] *= factor;
    }
  }

  function remuestrearRate(lista, rng) {
    let denom = 0;
    const num = Object.fromEntries(EDADES.map((e) => [e, 0]));
    for (let i = 0; i < lista.length; i++) {
      const c = lista[Math.floor(rng() * lista.length)];
      denom += c.eTotal;
      for (const edad of EDADES) num[edad] += c.cosechadoPorEdad[edad];
    }
    const rate = {};
    for (const edad of EDADES) rate[edad] = denom > 0 ? num[edad] / denom : 0;
    // tasasPorFinca() recorta reciente/estacional CADA UNO por separado antes
    // de promediarlos (ver aplicarClampSeguridad dentro de tasasPorFinca) —
    // el componente de bootstrap debe recortarse igual, individualmente, o
    // su media queda sesgada muy por encima del punto estimado (confirmado
    // depurando: promediar primero y recortar después, con una réplica cuyo
    // "estacional" no clampeado individualmente puede superar sumaRate=1.4,
    // arrastra el promedio de las 200 réplicas muy por encima del punto).
    clampSinContar(rate);
    return rate;
  }

  // Umbral mínimo para remuestrear con reemplazo. Por debajo de esto, el
  // bootstrap queda SESGADO: con muestras muy chicas (ej. "estacional" con
  // ~9 semanas), una fracción notable de las réplicas resampleadas supera
  // matemáticamente el 100% por puro ruido de muestreo chico, choca contra
  // el clamp de seguridad, y ese "apilamiento contra el techo" desplaza el
  // promedio del bootstrap muy por encima del punto estimado (confirmado
  // depurando: con N=9, sesgo de ratio-por-edad ponderado de +3 a +9% por
  // edad). Por debajo del umbral, se usa el valor fijo (sin remuestrear) del
  // componente — sigue aportando su valor a la mezcla, pero no le agrega
  // varianza espuria al intervalo de confianza.
  const BOOTSTRAP_MIN_N = 10;

  function tasaFija(lista) {
    let denom = 0;
    const num = Object.fromEntries(EDADES.map((e) => [e, 0]));
    for (const c of lista) {
      denom += c.eTotal;
      for (const edad of EDADES) num[edad] += c.cosechadoPorEdad[edad];
    }
    const rate = {};
    for (const edad of EDADES) rate[edad] = denom > 0 ? num[edad] / denom : 0;
    // Mismo recorte individual que tasasPorFinca() aplica al punto estimado
    // (ver nota en remuestrearRate) — si no, este valor fijo queda más alto
    // que su propio punto estimado, sesgando la mezcla igual que arriba.
    clampSinContar(rate);
    return rate;
  }

  // Generador de una muestra de tasa por llamada: remuestrea con reemplazo
  // si hay evidencia suficiente (>=BOOTSTRAP_MIN_N), si no devuelve siempre
  // el mismo valor fijo (ver nota de BOOTSTRAP_MIN_N arriba).
  function creadorMuestraRate(lista, rng) {
    if (lista.length === 0) return () => null;
    if (lista.length < BOOTSTRAP_MIN_N) {
      const fija = tasaFija(lista);
      return () => fija;
    }
    return () => remuestrearRate(lista, rng);
  }

  // B réplicas de la tasa por edad de un grupo, con la MISMA estructura que
  // tasasBlend() (blend 50/50 reciente+estacional) — el bootstrap debe
  // reflejar la incertidumbre del estimador realmente usado, no uno distinto.
  function bootstrapTasasBlend(listaReciente, listaEstacional, rng) {
    const genRec = creadorMuestraRate(listaReciente, rng);
    const genEst = creadorMuestraRate(listaEstacional, rng);
    const replicas = [];
    for (let b = 0; b < BOOTSTRAP_B; b++) {
      const rateRec = genRec();
      const rateEst = genEst();
      const rawRate = {};
      for (const edad of EDADES) {
        if (rateRec && rateEst) rawRate[edad] = (rateRec[edad] + rateEst[edad]) / 2;
        else if (rateRec) rawRate[edad] = rateRec[edad];
        else if (rateEst) rawRate[edad] = rateEst[edad];
        else rawRate[edad] = 0;
      }
      clampSinContar(rawRate);
      replicas.push(rawRate);
    }
    return replicas;
  }

  function remuestrearPromedio(lista, rng) {
    if (lista.length === 0) return null;
    let suma = 0;
    for (let i = 0; i < lista.length; i++) suma += lista[Math.floor(rng() * lista.length)];
    return suma / lista.length;
  }

  // Mismo criterio que creadorMuestraRate, aplicado a listas de valores de
  // ratio en vez de cohortes.
  function creadorMuestraPromedio(lista, rng) {
    if (lista.length === 0) return () => null;
    if (lista.length < BOOTSTRAP_MIN_N) {
      const fija = promedio(lista);
      return () => fija;
    }
    return () => remuestrearPromedio(lista, rng);
  }

  function ratiosRecientes(fincaIdList) {
    const ratios = [];
    for (let idx = startIdx - 1; idx >= 0 && ratios.length < SEMANAS_RATIO; idx--) {
      if (!esReal(idx)) continue;
      let r = 0;
      let c = 0;
      for (const fincaId of fincaIdList) {
        r += cosechado(fincaId, idx);
        c += cajas(fincaId, idx);
      }
      if (r > 0 && c > 0) ratios.push(c / r);
    }
    return ratios;
  }

  // Todas las semanas reales de la misma temporada (±1 semana) en años
  // anteriores — sin tope, ya que naturalmente hay pocas (una por año).
  function ratiosEstacionales(fincaIdList) {
    const ratios = [];
    for (let idx = 0; idx < semanas.length; idx++) {
      if (!esReal(idx) || !esEstacional(idx)) continue;
      let r = 0;
      let c = 0;
      for (const fincaId of fincaIdList) {
        r += cosechado(fincaId, idx);
        c += cajas(fincaId, idx);
      }
      if (r > 0 && c > 0) ratios.push(c / r);
    }
    return ratios;
  }

  function promedio(lista) {
    return lista.length > 0 ? lista.reduce((a, b) => a + b, 0) / lista.length : null;
  }

  // Ratio de respaldo global: toda la ventana traída, sin filtrar por
  // semana — mismo criterio "de último recurso" que la tasa global de arriba.
  function ratiosTodas(fincaIdList) {
    const ratios = [];
    for (let idx = 0; idx < semanas.length; idx++) {
      if (!esReal(idx)) continue;
      let r = 0;
      let c = 0;
      for (const fincaId of fincaIdList) {
        r += cosechado(fincaId, idx);
        c += cajas(fincaId, idx);
      }
      if (r > 0 && c > 0) ratios.push(c / r);
    }
    return ratios;
  }
  const listaRatiosGlobalTodas = ratiosTodas([...fincaIdsConDatos]);
  const ratioGlobalProm = promedio(listaRatiosGlobalTodas) ?? 0;

  // --- Proyección de embolse futuro -----------------------------------------
  // racimosProyectados se calcula multiplicando embolse(semana E) × tasa por
  // edad — pero embolse() solo tiene datos para semanas YA embolsadas. Para
  // una semana de cosecha más allá de ~EDAD_MAX-1 semanas desde hoy, TODAS
  // las semanas de embolse que la alimentan (E = cosecha - edad + 1, edad
  // 8-12) son futuras y no tienen dato real — sin esto, racimosProyectados
  // (y por lo tanto cajas) cae a 0 en vez de seguir proyectando. Se resuelve
  // con el mismo enfoque reciente+estacional ya usado para el Ratio: un
  // nivel semanal de embolse (promedio de semanas recientes combinado con la
  // misma temporada de años anteriores) que rellena únicamente las semanas
  // de embolse que todavía no ocurrieron — el embolse ya registrado nunca se
  // reemplaza por la proyección.
  //
  // Efecto colateral importante al agregar esto: expuso una fuga de futuro
  // real que existía desde v1 y que el guard anti-fuga del backtest
  // (verificarSinFuga) NUNCA detectó, porque solo audita la fila de salida
  // (semanaUuid/real), no los datos INTERNOS usados para construirla. Antes,
  // embolseGrupo(idx) para una semana de embolse "futura" respecto a asOfDate
  // devolvía el dato real igual — porque en la base de datos ESE embolse ya
  // había ocurrido (estamos corriendo el backtest hoy, con toda la historia
  // disponible) aunque fuera posterior al asOfDate simulado. En vivo esto era
  // invisible (asOfDate=hoy real, el futuro genuinamente no existe todavía),
  // pero en cada backtest inflaba artificialmente la precisión a horizontes
  // largos (12 semanas: MAPE 25.9%→47.1% real, Bias -6.3%→+17.7% real, tras
  // corregir — los números reportados en el plan para pasos 3-5 a horizontes
  // ≥~9 semanas se midieron bajo esta fuga y son optimistas para ese tramo;
  // las comparaciones RELATIVAS entre variantes siguen siendo válidas porque
  // la fuga afectaba a todas las variantes por igual, pero el nivel absoluto
  // de precisión a 12 semanas es peor de lo documentado). La tabla de
  // cuantiles de error (pronostico.errorQuantiles.json) se regeneró después
  // de este fix — el IC ya refleja la incertidumbre real.
  function embolseRecientes(fincaIdList) {
    const valores = [];
    for (let idx = startIdx - 1; idx >= 0 && valores.length < SEMANAS_RATIO; idx--) {
      if (!esReal(idx)) continue;
      const total = embolseGrupo(fincaIdList, idx);
      if (total > 0) valores.push(total);
    }
    return valores;
  }

  function embolseEstacionales(fincaIdList) {
    const valores = [];
    for (let idx = 0; idx < semanas.length; idx++) {
      if (!esReal(idx) || !esEstacional(idx)) continue;
      const total = embolseGrupo(fincaIdList, idx);
      if (total > 0) valores.push(total);
    }
    return valores;
  }

  function embolseTodos(fincaIdList) {
    const valores = [];
    for (let idx = 0; idx < semanas.length; idx++) {
      if (!esReal(idx)) continue;
      const total = embolseGrupo(fincaIdList, idx);
      if (total > 0) valores.push(total);
    }
    return valores;
  }
  const embolseGlobalProm = promedio(embolseTodos([...fincaIdsConDatos])) ?? 0;

  // --- Holt-Winters (paso 5, experimental — ver HW_EXPERIMENTO_ACTIVO) ------
  // Semana 53 (años bisiestos de calendario) se pliega sobre el bucket 52 —
  // Holt-Winters necesita una fase fija de 1..52, no una 53ava fase que solo
  // existe algunos años.
  function faseSemana(numeroSemana) {
    return numeroSemana >= HW_M ? HW_M : numeroSemana;
  }

  function promedioNoNulo(valores) {
    const validos = valores.filter((v) => v != null);
    return validos.length > 0 ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
  }

  // Serie semanal completa (con huecos) del ratio real, en orden cronológico
  // — a diferencia de ratiosRecientes/ratiosEstacionales (que solo toman
  // subconjuntos de semanas), Holt-Winters necesita la serie continua para
  // separar nivel, tendencia y estacionalidad.
  function construirSerieRatioSemanal(fincaIdList) {
    const serie = [];
    for (let idx = 0; idx < semanas.length; idx++) {
      if (!esReal(idx)) continue;
      let r = 0;
      let c = 0;
      for (const fincaId of fincaIdList) {
        r += cosechado(fincaId, idx);
        c += cajas(fincaId, idx);
      }
      serie.push({ fase: faseSemana(semanas[idx].numeroSemana), valor: r > 0 && c > 0 ? c / r : null });
    }
    // Recorta los huecos iniciales (semanas de calendario ya creadas antes de
    // que existiera seguimiento operativo real, o antes de que una finca
    // específica empezara a operar) — sin esto, la inicialización clásica de
    // Holt-Winters (primeros 2 ciclos = primeras 104 semanas de la serie)
    // caía siempre dentro de esa "zona muerta" para cualquier finca/GLOBAL
    // con historial de calendario más largo que su historial operativo real
    // (confirmado: para GLOBAL, el calendario existe desde 2021-01 pero el
    // primer dato operativo real es de 2023-01 — sin este recorte, mediaCiclo1
    // siempre era null y Holt-Winters nunca llegaba a activarse).
    const primerValido = serie.findIndex((p) => p.valor != null);
    return primerValido === -1 ? [] : serie.slice(primerValido);
  }

  // Ajusta un Holt-Winters aditivo (nivel+tendencia+estacionalidad) con
  // parámetros α/β/γ fijos, sobre una serie con huecos. Inicialización
  // clásica con los 2 primeros ciclos completos (L_m=media ciclo1,
  // T_m=(media ciclo2-media ciclo1)/m, S_i=promedio de cada ciclo
  // detrendado), luego recursión desde la semana m+1 hasta el final —
  // reprocesa el ciclo 2 vía la recursión (práctica estándar de
  // inicialización clásica, no un error). Semanas sin dato "coastean": el
  // nivel avanza por la tendencia (para no desalinear la fase de las
  // semanas siguientes) pero NI el nivel real ni la tendencia ni la
  // estacionalidad se actualizan con una observación que no existe.
  function ajustarHoltWinters(serie, alpha, beta, gamma) {
    const m = HW_M;
    const ciclo1 = serie.slice(0, m).map((p) => p.valor);
    const ciclo2 = serie.slice(m, 2 * m).map((p) => p.valor);
    const mediaCiclo1 = promedioNoNulo(ciclo1);
    const mediaCiclo2 = promedioNoNulo(ciclo2);
    if (mediaCiclo1 == null || mediaCiclo2 == null) return null;

    let L = mediaCiclo1;
    let T = (mediaCiclo2 - mediaCiclo1) / m;
    const S = new Array(m + 1).fill(0); // índice 1..m (0 sin uso)
    for (let i = 0; i < m; i++) {
      const d1 = ciclo1[i] != null ? ciclo1[i] - mediaCiclo1 : null;
      const d2 = ciclo2[i] != null ? ciclo2[i] - mediaCiclo2 : null;
      S[i + 1] = promedioNoNulo([d1, d2]) ?? 0;
    }
    const sesgoS = S.reduce((a, b) => a + b, 0) / m;
    for (let i = 1; i <= m; i++) S[i] -= sesgoS;

    let sse = 0;
    let sseN = 0;
    for (let t = m; t < serie.length; t++) {
      const { fase, valor: y } = serie[t];
      const pred = L + T + S[fase];
      if (y != null) {
        sse += (y - pred) ** 2;
        sseN++;
        const Lprev = L;
        L = alpha * (y - S[fase]) + (1 - alpha) * (L + T);
        T = beta * (L - Lprev) + (1 - beta) * T;
        S[fase] = gamma * (y - L) + (1 - gamma) * S[fase];
      } else {
        L = L + T;
      }
    }
    return { L, T, S, mape: sseN > 0 ? sse / sseN : Infinity };
  }

  // Grid search (5×5×5=125 combinaciones) de α/β/γ, minimizando el SSE de
  // predicción de un paso adelante sobre las semanas reales disponibles
  // (después de la inicialización) — barato: 125 × ~190 semanas es
  // negligible por request.
  function ajustarHoltWintersOptimo(serie) {
    if (serie.length < HW_MIN_SEMANAS) return null;
    let mejor = null;
    for (const alpha of HW_GRID) {
      for (const beta of HW_GRID) {
        for (const gamma of HW_GRID) {
          const modelo = ajustarHoltWinters(serie, alpha, beta, gamma);
          if (modelo && (!mejor || modelo.mape < mejor.mape)) {
            mejor = { ...modelo, alpha, beta, gamma };
          }
        }
      }
    }
    return mejor;
  }

  // Proyección h semanas adelante del último estado ajustado. Recorte de
  // sanidad: un ratio (cajas por racimo) fuera de [0, 2] es imposible en la
  // práctica — sin este tope, una extrapolación de tendencia a 53 semanas
  // (el máximo permitido por el validator) podría alejarse sin límite.
  function proyectarHoltWinters(modelo, hSemanas, faseObjetivo) {
    const valor = modelo.L + hSemanas * modelo.T + modelo.S[faseObjetivo];
    return Math.max(0, Math.min(2, valor));
  }

  // B réplicas de la tasa y del ratio "de respaldo" (toda la ventana, sin
  // filtrar por semana) — se calculan UNA vez por request y se reutilizan
  // para cualquier grupo que caiga en el respaldo global, en vez de
  // recalcularlas por grupo.
  const rng = crearRng(20260101);
  const listaCohortesGlobal = listaCohortesRate([...fincaIdsConDatos], null);
  const genRateGlobal = creadorMuestraRate(listaCohortesGlobal, rng);
  const globalRateReplicas = [];
  for (let b = 0; b < BOOTSTRAP_B; b++) {
    const rate = genRateGlobal() || Object.fromEntries(EDADES.map((e) => [e, 0]));
    clampSinContar(rate);
    globalRateReplicas.push(rate);
  }
  const genRatioGlobal = creadorMuestraPromedio(listaRatiosGlobalTodas, rng);
  const globalRatioReplicas = [];
  for (let b = 0; b < BOOTSTRAP_B; b++) {
    globalRatioReplicas.push(genRatioGlobal() ?? 0);
  }

  // IC 90% "real" (predictivo) a partir de la distribución empírica de
  // errores h-semanas-adelante observados en el backtest — NO del bootstrap.
  // El bootstrap (bootstrapTasasBlend/percentilesCi más abajo) mide solo
  // cuánto cambiaría la tasa/ratio estimados con otra muestra de cohortes —
  // eso es incertidumbre del ESTIMADOR, no el error real de pronóstico, que
  // además incluye el sesgo estructural del modelo (~-8%, ver nota de
  // MIN_COHORTES_FINCA) y la variabilidad semana-a-semana genuina. Medido
  // con backtest, el bootstrap solo cubría ~6-10% de los casos reales contra
  // un objetivo de 90%; el error empírico, validado en holdout, cubre 94-100%
  // (ver scripts/generar-cuantiles-error.mjs). Se conserva el bootstrap como
  // diagnóstico interno (cajasCiLowEstimador/cajasCiHighEstimador) porque
  // responde una pregunta distinta y legítima ("¿cuán estable es la tasa
  // estimada con los datos que tengo?"), no porque compita con este IC.
  function ciEmpirica(cajasPunto, horizonte) {
    if (!cuantilesError || cajasPunto <= 0) return null;
    const hMax = cuantilesError.horizonteMax;
    let q = cuantilesError.cuantiles[String(Math.min(horizonte, hMax))];
    if (!q) return null;
    if (horizonte > hMax) {
      // Sin validación de backtest más allá de hMax semanas (rango máximo con
      // datos históricos suficientes) — se extrapola ensanchando el intervalo
      // con sqrt(horizonte/hMax), la tasa de crecimiento típica de un error
      // acumulado tipo random-walk. Documentado como extrapolación, no medido.
      const factor = Math.sqrt(horizonte / hMax);
      q = { lo: q.lo * factor, hi: q.hi * factor };
    }
    return {
      low: Math.round(cajasPunto * (1 + q.lo) * 100) / 100,
      high: Math.round(cajasPunto * (1 + q.hi) * 100) / 100,
    };
  }

  // Percentiles empíricos de una lista de réplicas ya ordenada asc — IC 90%
  // (percentiles 5 y 95; índices 10 y 190 para B=200) del ESTIMADOR
  // (bootstrap), no del pronóstico — ver nota de ciEmpirica arriba.
  function percentilesCi(replicasOrdenadas) {
    const n = replicasOrdenadas.length;
    const low = replicasOrdenadas[Math.floor(0.05 * (n - 1))];
    const high = replicasOrdenadas[Math.ceil(0.95 * (n - 1))];
    return { low, high };
  }

  // Sin fincas explícitas en el filtro ("Todas"), el pronóstico es UN solo
  // grupo global (suma de todas las fincas permitidas) en vez de una fila
  // por finca por semana — 21 fincas en paralelo no es "el global", es 21
  // pronósticos individuales. Con una o más fincas elegidas explícitamente,
  // cada una sigue siendo su propio grupo (para poder comparlas).
  const esGlobal = !query.fincaUuids || !String(query.fincaUuids).trim();
  const grupos = esGlobal
    ? [{ uuid: null, codigo: 'GLOBAL', nombre: 'Todas las fincas', idList: fincas.map((f) => f.id) }]
    : fincas.map((f) => ({ uuid: f.uuid, codigo: f.codigo, nombre: f.nombre, idList: [f.id] }));

  const rows = [];
  for (const grupo of grupos) {
    const { rawRate: rateGrupo, pctNoCosechado: pctGrupoHist, cohortesCerradas, usoEstacional: usoEstacionalTasa } = tasasBlend(grupo.idList);
    const usaFallbackGlobal = cohortesCerradas < MIN_COHORTES_FINCA;
    const rate = usaFallbackGlobal ? global.rawRate : rateGrupo;
    const pctNoCosechadoHistorico = usaFallbackGlobal ? global.pctNoCosechado ?? 0 : pctGrupoHist ?? global.pctNoCosechado ?? 0;

    // Ratio: promedio de las últimas semanas reales ("reciente") combinado
    // con el promedio de la misma semana en años anteriores ("estacional").
    // Si falta una señal se usa solo la otra; si faltan ambas, se cae al
    // promedio global (con blend de peso si hay poca muestra reciente).
    const listaReciente = ratiosRecientes(grupo.idList);
    const listaEstacional = ratiosEstacionales(grupo.idList);
    const promRecienteProp = promedio(listaReciente);
    const promEstacional = promedio(listaEstacional);
    let ratioProyectado;
    let usoEstacionalRatio = false;
    if (promRecienteProp != null && promEstacional != null) {
      ratioProyectado = (promRecienteProp + promEstacional) / 2;
      usoEstacionalRatio = true;
    } else if (promEstacional != null && listaReciente.length === 0) {
      ratioProyectado = promEstacional;
      usoEstacionalRatio = true;
    } else if (listaReciente.length >= MIN_SEMANAS_RATIO_FINCA) {
      ratioProyectado = promRecienteProp;
    } else if (listaReciente.length > 0) {
      const peso = listaReciente.length / MIN_SEMANAS_RATIO_FINCA;
      ratioProyectado = promRecienteProp * peso + ratioGlobalProm * (1 - peso);
    } else {
      ratioProyectado = ratioGlobalProm;
    }
    const semanasRealesGrupo = listaReciente;

    // Nivel de embolse proyectado para semanas futuras — mismo blend
    // reciente+estacional que el Ratio (ver nota junto a embolseRecientes
    // más arriba). embolseProyectado(idx) solo lo usa para semanas de
    // embolse que todavía no tienen dato real; el resto pasa el dato real
    // sin tocar.
    const listaEmbolseReciente = embolseRecientes(grupo.idList);
    const listaEmbolseEstacional = embolseEstacionales(grupo.idList);
    const promEmbolseReciente = promedio(listaEmbolseReciente);
    const promEmbolseEstacional = promedio(listaEmbolseEstacional);
    let embolseProyectadoNivel;
    let usoEstacionalEmbolse = false;
    if (promEmbolseReciente != null && promEmbolseEstacional != null) {
      embolseProyectadoNivel = (promEmbolseReciente + promEmbolseEstacional) / 2;
      usoEstacionalEmbolse = true;
    } else if (promEmbolseEstacional != null && listaEmbolseReciente.length === 0) {
      embolseProyectadoNivel = promEmbolseEstacional;
      usoEstacionalEmbolse = true;
    } else if (listaEmbolseReciente.length >= MIN_SEMANAS_RATIO_FINCA) {
      embolseProyectadoNivel = promEmbolseReciente;
    } else if (listaEmbolseReciente.length > 0) {
      const peso = listaEmbolseReciente.length / MIN_SEMANAS_RATIO_FINCA;
      embolseProyectadoNivel = promEmbolseReciente * peso + embolseGlobalProm * (1 - peso);
    } else {
      embolseProyectadoNivel = embolseGlobalProm;
    }
    function embolseProyectado(srcIdx) {
      if (srcIdx < 0 || srcIdx >= semanas.length) return 0;
      return esReal(srcIdx) ? embolseGrupo(grupo.idList, srcIdx) : embolseProyectadoNivel;
    }

    // Holt-Winters (experimental, ver HW_EXPERIMENTO_ACTIVO): con suficiente
    // historial real propio, reemplaza el ratio FIJO de arriba por uno que
    // varía por semana (nivel + tendencia + estacionalidad) — si no hay
    // suficiente historial o el ajuste no converge, sigue usando
    // `ratioProyectado` (el blend 50/50 de siempre) sin cambios.
    let modeloHW = null;
    if (HW_EXPERIMENTO_ACTIVO) {
      const serieHW = construirSerieRatioSemanal(grupo.idList);
      modeloHW = ajustarHoltWintersOptimo(serieHW);
    }
    function ratioParaOffset(offset, idx) {
      if (modeloHW) return proyectarHoltWinters(modeloHW, offset, faseSemana(semanas[idx].numeroSemana));
      return ratioProyectado;
    }

    // Réplicas de bootstrap para el intervalo de confianza: mismo respaldo
    // que el punto estimado (global si `usaFallbackGlobal`, propias si no) —
    // reutiliza las réplicas globales ya calculadas una vez por request en
    // vez de recalcularlas por grupo cuando corresponde.
    const rateReplicas = usaFallbackGlobal
      ? globalRateReplicas
      : bootstrapTasasBlend(listaCohortesRate(grupo.idList, esReciente), listaCohortesRate(grupo.idList, esEstacional), rng);
    const genRatioReciente = creadorMuestraPromedio(listaReciente, rng);
    const genRatioEstacional = creadorMuestraPromedio(listaEstacional, rng);
    const ratioReplicas = [];
    for (let b = 0; b < BOOTSTRAP_B; b++) {
      const pr = genRatioReciente();
      const pe = genRatioEstacional();
      const pg = globalRatioReplicas[b];
      let ratioB;
      if (pr != null && pe != null) ratioB = (pr + pe) / 2;
      else if (pe != null && listaReciente.length === 0) ratioB = pe;
      else if (listaReciente.length >= MIN_SEMANAS_RATIO_FINCA) ratioB = pr;
      else if (listaReciente.length > 0) {
        const peso = listaReciente.length / MIN_SEMANAS_RATIO_FINCA;
        ratioB = pr * peso + pg * (1 - peso);
      } else {
        ratioB = pg;
      }
      ratioReplicas.push(ratioB);
    }

    // Un solo escalar reescala toda la curva de edad — así "% no cosechado"
    // puede ser un único campo editable en vez de 3 columnas.
    const scaleFactor =
      pctNoCosechadoOverride != null
        ? (1 - pctNoCosechadoOverride) / Math.max(0.0001, 1 - pctNoCosechadoHistorico)
        : 1;

    // Aprovechamiento = (RECUSE+PROCESADO)/EMBOLSADO — mismo concepto que ya
    // usa el dashboard de Corbana. Para semanas proyectadas es el % efectivo
    // que se está aplicando (el override si hay uno, si no el histórico);
    // para semanas reales se muestra siempre el histórico, ya que el
    // override no cambia lo que ya ocurrió.
    const aprovechamientoProyectado = pctNoCosechadoOverride != null ? 1 - pctNoCosechadoOverride : 1 - pctNoCosechadoHistorico;
    const aprovechamientoHistorico = 1 - pctNoCosechadoHistorico;

    for (let offset = 0; offset < semanasCount; offset++) {
      const idx = startIdx + offset;
      if (idx >= semanas.length) break;
      const semana = semanas[idx];
      const real = esReal(idx);

      const ageBreakdown = EDADES.map((edad) => {
        const srcIdx = idx - edad + 1;
        const proyectado = embolseProyectado(srcIdx) * rate[edad] * (real ? 1 : scaleFactor);
        return { edad, racimos: Math.round(proyectado) };
      });
      const racimosProyectados = ageBreakdown.reduce((acc, a) => acc + a.racimos, 0);
      const embolseFuturoUsado = !real && EDADES.some((edad) => {
        const srcIdx = idx - edad + 1;
        return srcIdx >= 0 && srcIdx < semanas.length && !esReal(srcIdx);
      });

      let racimosCosechados;
      let cajas20kg;
      let ratioUsado = ratioProyectado;
      let confianza;
      let cajasCiLow = null;
      let cajasCiHigh = null;
      let cajasCiLowEstimador = null;
      let cajasCiHighEstimador = null;

      if (real) {
        const rReal = cosechadoGrupo(grupo.idList, idx);
        const cReal = cajasGrupo(grupo.idList, idx);
        if (rReal > 0 && cReal > 0) {
          racimosCosechados = rReal;
          ratioUsado = cReal / rReal;
          cajas20kg = cReal;
          confianza = 'Real';
        } else if (rReal > 0) {
          racimosCosechados = rReal;
          cajas20kg = Math.round(rReal * ratioProyectado * 100) / 100;
          confianza = 'Media';
        } else {
          racimosCosechados = racimosProyectados;
          cajas20kg = Math.round(racimosProyectados * ratioProyectado * 100) / 100;
          confianza = usaFallbackGlobal ? 'Baja' : 'Media';
        }
      } else {
        racimosCosechados = racimosProyectados;
        ratioUsado = ratioParaOffset(offset, idx);
        cajas20kg = Math.round(racimosProyectados * ratioUsado * 100) / 100;

        // Intervalo de confianza por bootstrap: embolse no se remuestrea (es
        // un dato conocido, no incierto) — solo la tasa por edad y el ratio,
        // aplicados B veces con los mismos hiperparámetros que el punto
        // estimado. Remuestreo pareado (misma réplica b para tasa y ratio)
        // para no mezclar incertidumbres de fuentes independientes.
        const embolsePorEdad = EDADES.map((edad) => embolseProyectado(idx - edad + 1));
        const cajasReplicas = new Array(BOOTSTRAP_B);
        for (let b = 0; b < BOOTSTRAP_B; b++) {
          const rateB = rateReplicas[b];
          let racimosB = 0;
          for (let ei = 0; ei < EDADES.length; ei++) racimosB += embolsePorEdad[ei] * rateB[EDADES[ei]] * scaleFactor;
          cajasReplicas[b] = racimosB * ratioReplicas[b];
        }
        cajasReplicas.sort((a, b) => a - b);
        const ciEstimador = percentilesCi(cajasReplicas);
        cajasCiLowEstimador = Math.round(ciEstimador.low * 100) / 100;
        cajasCiHighEstimador = Math.round(ciEstimador.high * 100) / 100;

        const ci = ciEmpirica(cajas20kg, offset);
        if (ci) {
          cajasCiLow = ci.low;
          cajasCiHigh = ci.high;
          const anchoRelativo = (cajasCiHigh - cajasCiLow) / (2 * cajas20kg);
          if (anchoRelativo < 0.3) confianza = 'Alta';
          else if (anchoRelativo < 0.6) confianza = 'Media';
          else confianza = 'Baja';
        } else {
          // Sin tabla de cuantiles cargada (ver warning al iniciar el
          // proceso): degrada al ancho del estimador antes que dejar
          // `confianza` sin definir.
          const anchoRelativo = cajas20kg > 0 ? (cajasCiHighEstimador - cajasCiLowEstimador) / (2 * cajas20kg) : 1;
          if (anchoRelativo < 0.1) confianza = 'Alta';
          else if (anchoRelativo < 0.25) confianza = 'Media';
          else confianza = 'Baja';
        }
      }

      const detalle = real
        ? 'Semana con datos reales registrados'
        : (modeloHW ? 'Ratio proyectado con tendencia y estacionalidad (Holt-Winters)' : `Ratio basado en ${semanasRealesGrupo.length} semana(s) real(es)`) +
          (usoEstacionalRatio && !modeloHW ? ' + misma semana de años anteriores' : '') +
          (usaFallbackGlobal ? ` · edades ${EDADES[0]}-${EDAD_MAX} sin historial propio suficiente, usando promedio global` : '') +
          (usoEstacionalTasa && !usaFallbackGlobal ? ' · aprovechamiento combinado con la misma temporada de años anteriores' : '') +
          (embolseFuturoUsado ? ` · embolse de semanas futuras estimado (${usoEstacionalEmbolse ? 'reciente + misma temporada de años anteriores' : 'promedio reciente'})` : '') +
          (cajasCiLow != null ? ` · IC 90%: ${Math.round(cajasCiLow).toLocaleString('es')}–${Math.round(cajasCiHigh).toLocaleString('es')} cajas` : '');

      const aprovechamiento = real ? aprovechamientoHistorico : aprovechamientoProyectado;

      rows.push({
        fincaUuid: grupo.uuid,
        fincaCodigo: grupo.codigo,
        fincaNombre: grupo.nombre,
        semanaUuid: semana.uuid,
        semanaCodigo: semana.codigo,
        anio: semana.anio,
        numeroSemana: semana.numeroSemana,
        real,
        // Diagnóstico para el backtest por etapas (herramienta oficial de
        // validación, ver scripts/backtest-pronostico.mjs): el embolse
        // (real o proyectado, ver embolseProyectado más arriba) de la
        // SEMANA PROPIA de esta fila — no el usado internamente para
        // construir racimosCosechados (que mezcla 5 semanas de embolse
        // distintas, una por edad). Permite medir la etapa 1
        // (racimos embolsados) de forma completamente independiente.
        embolseProyectado: embolseProyectado(idx),
        racimosCosechados,
        ratio: Math.round(ratioUsado * 10000) / 10000,
        aprovechamiento: Math.round(aprovechamiento * 10000) / 10000,
        cajas20kg,
        cajasCiLow,
        cajasCiHigh,
        // Diagnóstico interno (incertidumbre del estimador, no del pronóstico
        // — ver nota en ciEmpirica): no se usa para `confianza` ni `detalle`.
        cajasCiLowEstimador,
        cajasCiHighEstimador,
        confianza,
        detalle,
        ageBreakdown,
      });
    }
  }

  return {
    meta: {
      fincas: fincas.map((f) => ({ uuid: f.uuid, codigo: f.codigo, nombre: f.nombre })),
      semanaInicio: {
        uuid: semanaInicio.uuid,
        codigo: semanaInicio.codigo,
        anio: semanaInicio.anio,
        numeroSemana: semanaInicio.numeroSemana,
      },
      semanas: semanasCount,
      semanasDisponibles,
      calendarioIncompleto,
      ultimaSemanaCalendario: ultimaSemanaDisponible
        ? { codigo: ultimaSemanaDisponible.codigo, anio: ultimaSemanaDisponible.anio, numeroSemana: ultimaSemanaDisponible.numeroSemana }
        : null,
      pctNoCosechadoOverride,
      pctNoCosechadoHistoricoPromedio: global.pctNoCosechado,
      // Diagnóstico, no exclusión — ver nota extensa junto a `cohortesAnomalas`
      // más arriba en el archivo (el backtest demostró que excluirlas empeora
      // la precisión; se dejan visibles aquí solo para auditoría).
      cohortesAnomalasDetectadas: {
        count: cohortesAnomalas.size,
        fincaIds: [...fincasConCohortesAnomalas],
      },
      clampsAplicados,
      // bootstrap = diagnóstico del estimador (cajasCiLowEstimador/High por
      // fila); intervaloEmpirico = de dónde sale el IC real (cajasCiLow/High)
      // — ver nota extensa junto a ciEmpirica más arriba.
      bootstrap: { B: BOOTSTRAP_B },
      intervaloEmpirico: cuantilesError
        ? {
            generadoEn: cuantilesError.generadoEn,
            trainDesde: cuantilesError.trainDesde,
            trainHasta: cuantilesError.trainHasta,
            coverageHoldout: cuantilesError.coverageHoldout,
            horizonteMax: cuantilesError.horizonteMax,
          }
        : null,
    },
    rows,
  };
}

// Named export solo para scripts/backtest-pronostico.mjs, que necesita pasar
// un `asOfDate` explícito para simular "hoy" en el pasado. La API en vivo
// (controller/rutas) sigue usando exclusivamente pronosticoService de abajo.
export { computeForecast };

export const pronosticoService = {
  getPronostico(query, user) {
    return computeForecast(query, user);
  },

  async exportPronosticoToExcel(query, user) {
    const { default: XLSX } = await import('xlsx');
    const { rows } = await computeForecast(query, user);

    const datos = rows.map((r) => ({
      Finca: r.fincaNombre,
      Semana: r.semanaCodigo,
      'Racimos cosechados': r.racimosCosechados,
      Ratio: r.ratio,
      'Aprovechamiento %': Math.round(r.aprovechamiento * 10000) / 100,
      'Cajas 20kg': r.cajas20kg,
      'IC 90% mínimo': r.cajasCiLow,
      'IC 90% máximo': r.cajasCiHigh,
      Confianza: r.confianza,
      Detalle: r.detalle,
      ...Object.fromEntries(r.ageBreakdown.map((a) => [`Edad ${a.edad}`, a.racimos])),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, 'Pronostico');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },
};

export default pronosticoService;
