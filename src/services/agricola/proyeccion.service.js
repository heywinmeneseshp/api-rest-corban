import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';
import { Finca, Semana, Producto, ProyeccionEscenario, ProyeccionArea, ProyeccionProducto } from '../../database/associations.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { racimoMovimientoRepository } from '../../repositories/agricola/racimoMovimiento.repository.js';
import { produccionSemanalRepository } from '../../repositories/agricola/produccionSemanal.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseBulkFile } from '../../utils/bulkFileParser.js';
import { assertFincaPermitida, getFincaIdsPermitidas } from '../../utils/fincaScope.js';

// Proyección anual de embolses y cajas por finca y semana, de abajo hacia arriba:
//   embolses(sem)  = hectáreas efectivas × embolses por hectárea de esa semana del año (promedio simple de los años históricos)
//   racimos(sem)   = Σ edad 8..12  embolses(sem - edad + 1) × tasa[edad]      (tasas históricas por finca)
//   cajas(sem)     = racimos × ratio cajas/racimo de esa semana del año (histórico por finca)
// Sin pesos a lo reciente: es una proyección anual. Las semanas ya transcurridas usan el dato real.
// Las hectáreas nuevas entran con una rampa (arrancan en rampaPct % del embolse por hectárea y suben a 100 %).

const EDADES = [8, 9, 10, 11, 12];
const EDAD_MAX = EDADES[EDADES.length - 1];
const MIN_COHORTES_FINCA = 5;
// Edad mínima de corte 8: el primer racimo se corta 7 semanas después de empezar a embolsar (semana de entrada).
const SEMANAS_A_PRIMER_CORTE = EDADES[0] - 1;
const TOLERANCIA_SEMANA = 1;
const MS_DIA = 24 * 60 * 60 * 1000;

export const PARAMS_POR_DEFECTO = {
  rampaPct: 50, // % del embolse por hectárea con el que arranca una hectárea nueva
  rampaSemanas: 12, // semanas que tarda en llegar al 100 %
  aniosHistoricos: 3, // cuántos años anteriores usar por defecto para la estacionalidad
  anios: [], // años históricos elegidos a mano (vacío = los últimos aniosHistoricos)
  hectareasBasePorFinca: {}, // { fincaUuid: ha } fija las hectáreas de partida de una finca (vacío = las reales de hoy)
  pctNoCosechado: null, // % no cosechado global (null = histórico de cada finca)
  pctNoCosechadoPorFinca: {}, // { fincaUuid: pct } (tiene prioridad sobre el global)
};

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function percentil(arr, p) {
  if (!arr.length) return null;
  const orden = [...arr].sort((a, b) => a - b);
  const pos = (orden.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return orden[lo] + (orden[hi] - orden[lo]) * (pos - lo);
}

const estadisticas = (arr) => (arr.length ? { mean: media(arr), p25: percentil(arr, 0.25), p75: percentil(arr, 0.75) } : null);

// Semana del año vecina (1..53, circular).
const distanciaSemana = (a, b) => {
  const d = Math.abs(a - b) % 53;
  return Math.min(d, 53 - d);
};

export function normalizarParams(params = {}) {
  const num = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const pct = (v) => (v === null || v === undefined || v === '' ? null : num(v, null, 0, 90));
  const porFinca = {};
  for (const [k, v] of Object.entries(params.pctNoCosechadoPorFinca || {})) {
    const valor = pct(v);
    if (valor !== null) porFinca[k] = valor;
  }
  const anios = [...new Set((Array.isArray(params.anios) ? params.anios : []).map(Number).filter((a) => Number.isInteger(a) && a >= 2000 && a <= 2100))].sort().slice(0, 6);
  const haBase = {};
  for (const [k, v] of Object.entries(params.hectareasBasePorFinca || {})) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) haBase[k] = n;
  }
  return {
    anios,
    hectareasBasePorFinca: haBase,
    rampaPct: num(params.rampaPct, PARAMS_POR_DEFECTO.rampaPct, 0, 100),
    rampaSemanas: Math.round(num(params.rampaSemanas, PARAMS_POR_DEFECTO.rampaSemanas, 0, 104)),
    aniosHistoricos: Math.round(num(params.aniosHistoricos, PARAMS_POR_DEFECTO.aniosHistoricos, 1, 5)),
    pctNoCosechado: pct(params.pctNoCosechado),
    pctNoCosechadoPorFinca: porFinca,
  };
}

// Hectáreas EN PRODUCCIÓN por finca y semana (carry-forward del último registro de cada lote; mismo criterio que
// dashboard.service.js pero agrupado por finca). Devuelve Map fincaId -> array alineado con `semanas`.
async function hectareasPorFinca(fincaIds, semanas) {
  const salida = new Map(fincaIds.map((id) => [id, semanas.map(() => 0)]));
  if (fincaIds.length === 0 || semanas.length === 0) return salida;
  const filas = await sequelize.query(
    `SELECT l.finca_id AS fincaId, ap.lote_id AS loteId, ap.area AS area, ap.id AS id,
            COALESCE(s.fecha_inicio, ap.fecha_registro) AS fecha
       FROM lote_area_produccion ap
       JOIN lotes l ON l.id = ap.lote_id AND l.deleted_at IS NULL
       LEFT JOIN semanas s ON s.id = ap.semana_id
      WHERE l.finca_id IN (:fincaIds)
      ORDER BY ap.lote_id, fecha, ap.id`,
    { replacements: { fincaIds }, type: QueryTypes.SELECT },
  );
  const porLote = new Map(); // loteId -> { fincaId, registros[] }
  for (const f of filas) {
    if (!porLote.has(f.loteId)) porLote.set(f.loteId, { fincaId: f.fincaId, registros: [] });
    porLote.get(f.loteId).registros.push({ fecha: String(f.fecha).slice(0, 10), area: Number(f.area) });
  }
  semanas.forEach((semana, i) => {
    const limite = iso(semana.fechaInicio);
    for (const { fincaId, registros } of porLote.values()) {
      let vigente = null;
      for (const r of registros) {
        if (r.fecha <= limite) vigente = r.area;
        else break;
      }
      if (vigente !== null) salida.get(fincaId)[i] += vigente;
    }
  });
  return salida;
}

async function resolverFincas(user, fincaUuidsCsv) {
  const permitidas = getFincaIdsPermitidas(user);
  const where = { estado: true, esExterna: false };
  if (fincaUuidsCsv) where.uuid = { [Op.in]: fincaUuidsCsv.split(',').map((s) => s.trim()).filter(Boolean) };
  if (permitidas !== null) where.id = { [Op.in]: permitidas };
  const fincas = await Finca.findAll({ where, attributes: ['id', 'uuid', 'codigo', 'nombre'], order: [['nombre', 'ASC']], raw: true });
  if (fincas.length === 0) throw ApiError.notFound('No hay fincas disponibles para la proyección');
  return fincas;
}

// Tasas por edad de una lista de fincas: proporción de lo embolsado que se corta a cada edad, sobre cohortes cerradas.
function calcularTasas(fincaIds, { emb, cohortes, hoyIdx }) {
  let denom = 0;
  let cohortesCerradas = 0;
  const num = Object.fromEntries(EDADES.map((e) => [e, 0]));
  const cerrada = (idx) => idx + EDAD_MAX - 1 <= hoyIdx;
  for (const id of fincaIds) {
    emb.get(id).forEach((v, idx) => {
      if (v > 0 && cerrada(idx)) {
        denom += v;
        cohortesCerradas++;
      }
    });
    for (const c of cohortes.get(id) || []) if (cerrada(c.embolseIdx)) num[c.edad] += c.total;
  }
  const tasas = Object.fromEntries(EDADES.map((e) => [e, denom > 0 ? num[e] / denom : 0]));
  let suma = EDADES.reduce((a, e) => a + tasas[e], 0);
  if (suma > 0.999) {
    for (const e of EDADES) tasas[e] *= 0.999 / suma;
    suma = 0.999;
  }
  return { tasas, suma, cohortesCerradas };
}

/**
 * Calcula la proyección de un escenario. `asOfDate` solo lo usa el backtest para simular "hoy" en el pasado.
 * escenario: { anio, params, areas: [{ fincaId, semanaId, hectareas }] }
 */
export async function calcularProyeccion({ anio, params, areas }, user, { fincaUuids, asOfDate = new Date() } = {}) {
  const p = normalizarParams(params);
  const fincas = await resolverFincas(user, fincaUuids);
  const fincaIds = fincas.map((f) => f.id);

  // Semanas: años históricos + el año proyectado (ordenadas por fecha real).
  const aniosHist = new Set(p.anios.length ? p.anios.filter((a) => a < anio) : Array.from({ length: p.aniosHistoricos }, (_, k) => anio - 1 - k));
  const anioDesde = Math.min(...aniosHist, anio - 2) - 1;
  const semanas = await Semana.findAll({
    where: { anio: { [Op.gte]: anioDesde, [Op.lte]: anio } },
    attributes: ['id', 'uuid', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'],
    order: [['fechaInicio', 'ASC']],
    raw: true,
  });
  const semanasAnio = semanas.map((s, idx) => ({ ...s, idx })).filter((s) => s.anio === anio);
  if (semanasAnio.length === 0) {
    throw ApiError.badRequest(`No hay semanas del ${anio} en el calendario. Créalas en Maestros → Semanas antes de proyectar.`);
  }
  const hoyISO = iso(asOfDate);
  let hoyIdx = -1;
  semanas.forEach((s, i) => {
    if (iso(s.fechaInicio) <= hoyISO) hoyIdx = i;
  });
  const idxPorId = new Map(semanas.map((s, i) => [s.id, i]));
  const semanaIds = semanas.map((s) => s.id);

  const [embolseMap, cosechadoMap, cajasMap, cohorteRows, haPorFinca] = await Promise.all([
    racimoMovimientoRepository.getEmbolsePorFincaYSemana({ fincaIds, semanaEmbolseIds: semanaIds }),
    racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds, semanaRegistroIds: semanaIds }),
    produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds, semanaIds }),
    racimoMovimientoRepository.getCosechadoPorFincaCohorte({ fincaIds, semanaEmbolseIds: semanaIds }),
    hectareasPorFinca(fincaIds, semanas),
  ]);

  const serie = (map, id) => semanas.map((s) => map.get(`${id}-${s.id}`) || 0);
  const emb = new Map(fincaIds.map((id) => [id, serie(embolseMap, id)]));
  const cos = new Map(fincaIds.map((id) => [id, serie(cosechadoMap, id)]));
  const caj = new Map(fincaIds.map((id) => [id, serie(cajasMap, id)]));
  const cohortes = new Map(fincaIds.map((id) => [id, []]));
  for (const row of cohorteRows) {
    const e = idxPorId.get(row.semanaEmbolseId);
    const r = idxPorId.get(row.semanaRegistroId);
    if (e === undefined || r === undefined || !cohortes.has(row.fincaId)) continue;
    const edad = r - e + 1;
    if (EDADES.includes(edad)) cohortes.get(row.fincaId).push({ embolseIdx: e, edad, total: row.total });
  }

  const esHistorica = (i) => i <= hoyIdx && aniosHist.has(semanas[i].anio);

  // ── Valores de respaldo globales (todas las fincas) ──
  const tasasGlobal = calcularTasas(fincaIds, { emb, cohortes, hoyIdx });
  const valoresEmbHaGlobal = [];
  let sumCajasG = 0;
  let sumCosG = 0;
  // Histórico global por semana del año (todas las fincas con registros): lo usan las fincas que no tienen historial propio
  // de esa semana. numeroSemana -> { valores: [embolses/ha por finca-semana], e, ha, c (cajas), k (racimos cosechados) }.
  const globalPorSemana = new Map();
  for (const id of fincaIds) {
    for (let i = 0; i < semanas.length; i++) {
      if (!esHistorica(i)) continue;
      const w = semanas[i].numeroSemana;
      const g = globalPorSemana.get(w) || { valores: [], e: 0, ha: 0, c: 0, k: 0 };
      const ha = haPorFinca.get(id)[i];
      if (ha > 0 && emb.get(id)[i] > 0) {
        valoresEmbHaGlobal.push(emb.get(id)[i] / ha);
        g.valores.push(emb.get(id)[i] / ha);
        g.e += emb.get(id)[i];
        g.ha += ha;
      }
      if (cos.get(id)[i] > 0 && caj.get(id)[i] > 0) {
        sumCajasG += caj.get(id)[i];
        sumCosG += cos.get(id)[i];
        g.c += caj.get(id)[i];
        g.k += cos.get(id)[i];
      }
      globalPorSemana.set(w, g);
    }
  }
  const statGlobal = estadisticas(valoresEmbHaGlobal);
  const ratioGlobal = sumCosG > 0 ? sumCajasG / sumCosG : 0;
  // Embolses por hectárea global de una semana del año (ventana de ±1 semana): media ponderada por hectáreas y percentiles 25/75.
  const statGlobalSemana = (w) => {
    const valores = [];
    let e = 0;
    let ha = 0;
    for (const [k, g] of globalPorSemana) {
      if (distanciaSemana(k, w) > TOLERANCIA_SEMANA) continue;
      valores.push(...g.valores);
      e += g.e;
      ha += g.ha;
    }
    return valores.length ? { mean: ha > 0 ? e / ha : media(valores), p25: percentil(valores, 0.25), p75: percentil(valores, 0.75) } : null;
  };
  // Ratio cajas/racimo global de una semana del año.
  const ratioGlobalSemana = (w) => {
    let c = 0;
    let k = 0;
    for (const [sem, g] of globalPorSemana) {
      if (distanciaSemana(sem, w) > TOLERANCIA_SEMANA) continue;
      c += g.c;
      k += g.k;
    }
    return k > 0 ? c / k : null;
  };

  // Entradas de hectáreas del plan, por finca.
  const advertencias = [];
  const entradasPorFinca = new Map(fincaIds.map((id) => [id, []]));
  for (const a of areas || []) {
    if (!entradasPorFinca.has(a.fincaId)) continue;
    const eIdx = idxPorId.get(a.semanaId);
    if (eIdx === undefined) continue;
    if (eIdx <= hoyIdx) {
      advertencias.push('Hay entradas de hectáreas en semanas ya transcurridas: se ignoran (ya están en las áreas reales).');
      continue;
    }
    // Una entrada con 0 hectáreas es un CIERRE: desde esa semana la finca no embolsa ni cosecha (racimos y cajas en 0; lo ya
    // embolsado tampoco se cosecha). Lo que se sume después parte de cero. Las demás son altas (positivas, con rampa) o bajas.
    entradasPorFinca.get(a.fincaId).push({ eIdx, ha: Number(a.hectareas), cierre: Number(a.hectareas) === 0, rampaPct: a.rampaPct, rampaSemanas: a.rampaSemanas });
  }
  // Rampa de una entrada: arranca en rampaPct % del embolse por hectárea y sube lineal al 100 % en rampaSemanas. Cada entrada
  // trae la suya; si no la tiene, usa la del escenario.
  const rampa = (k, e) => {
    const pct = e.rampaPct !== null && e.rampaPct !== undefined ? Number(e.rampaPct) : p.rampaPct;
    const semanasRampa = e.rampaSemanas !== null && e.rampaSemanas !== undefined ? Number(e.rampaSemanas) : p.rampaSemanas;
    if (semanasRampa <= 0) return 1;
    return Math.min(1, pct / 100 + (1 - pct / 100) * (k / semanasRampa));
  };

  const filas = []; // por finca y semana del año
  const alertasHa = [];
  const resumenFincas = [];
  // Serie histórica real por finca (y total) de los últimos 3 años, para las gráficas de cada finca: por año, una lista de
  // semanas { n: número de semana, e: embolses, ha: hectáreas, c: racimos cosechados, j: cajas }.
  // Incluye los 3 años anteriores y también todos los que el escenario usa para proyectar (aunque sean más antiguos).
  const aniosGraf = [...new Set([anio - 3, anio - 2, anio - 1, ...aniosHist])].sort();
  const historico = {};
  const fincasSinHistorial = [];

  for (const f of fincas) {
    const id = f.id;
    const E = emb.get(id);
    const C = cos.get(id);
    const J = caj.get(id);
    const HA = haPorFinca.get(id);
    const ha0Real = hoyIdx >= 0 ? HA[hoyIdx] : 0;
    const ha0 = p.hectareasBasePorFinca[f.uuid] ?? ha0Real;

    // Embolses por hectárea históricos, por semana del año.
    const porSemanaAnio = new Map(); // numeroSemana -> valores
    const todos = [];
    for (let i = 0; i < semanas.length; i++) {
      if (!esHistorica(i)) continue;
      if (HA[i] > 0 && E[i] > 0) {
        const v = E[i] / HA[i];
        todos.push(v);
        const w = semanas[i].numeroSemana;
        if (!porSemanaAnio.has(w)) porSemanaAnio.set(w, []);
        porSemanaAnio.get(w).push(v);
      }
    }
    if (todos.length === 0) fincasSinHistorial.push(f.nombre);
    // Si la finca no tiene historial de esa semana del año (o ninguno), usa el histórico global de las fincas con registros.
    const statSemana = (w) => {
      const vals = [];
      for (const [k, arr] of porSemanaAnio) if (distanciaSemana(k, w) <= TOLERANCIA_SEMANA) vals.push(...arr);
      return estadisticas(vals) || statGlobalSemana(w) || statGlobal;
    };

    // Ratio cajas/racimo por semana del año.
    const ratioSemana = (w) => {
      let c = 0;
      let k = 0;
      for (let i = 0; i < semanas.length; i++) {
        if (!esHistorica(i) || !(C[i] > 0 && J[i] > 0)) continue;
        if (distanciaSemana(semanas[i].numeroSemana, w) <= TOLERANCIA_SEMANA) { c += J[i]; k += C[i]; }
      }
      return k > 0 ? c / k : ratioGlobalSemana(w) ?? ratioGlobal;
    };

    // Tasas por edad (propias si hay cohortes suficientes; si no, las globales) y override de % no cosechado.
    const propias = calcularTasas([id], { emb, cohortes, hoyIdx });
    const usaGlobal = propias.cohortesCerradas < MIN_COHORTES_FINCA;
    const base = usaGlobal ? tasasGlobal : propias;
    const aprovechamientoHistorico = base.suma;
    const pctOverride = p.pctNoCosechadoPorFinca[f.uuid] ?? p.pctNoCosechado;
    let tasas = { ...base.tasas };
    let aprovechamientoAplicado = base.suma;
    if (pctOverride !== null && pctOverride !== undefined && base.suma > 0) {
      const objetivo = Math.min(0.999, 1 - pctOverride / 100);
      const k = objetivo / base.suma;
      tasas = Object.fromEntries(EDADES.map((e) => [e, base.tasas[e] * k]));
      aprovechamientoAplicado = objetivo;
    }

    // Hectáreas nominales y efectivas por semana.
    const entradas = [...entradasPorFinca.get(id)].sort((a, b) => a.eIdx - b.eIdx || Number(b.cierre) - Number(a.cierre));
    // Nivel de la finca en la semana i: parte de las hectáreas base, o de 0 si hubo un cierre; solo cuentan las entradas
    // posteriores al último cierre.
    const nivelEn = (i) => {
      const hasta = entradas.filter((e) => i >= e.eIdx);
      let ultimoCierre = -1;
      hasta.forEach((e, k) => {
        if (e.cierre) ultimoCierre = k;
      });
      return ultimoCierre >= 0 ? { base: 0, vigentes: hasta.slice(ultimoCierre + 1) } : { base: ha0, vigentes: hasta };
    };
    const haNominal = semanas.map((_, i) => {
      if (i <= hoyIdx) return HA[i];
      const { base, vigentes } = nivelEn(i);
      return Math.max(0, base + vigentes.reduce((a, e) => a + e.ha, 0));
    });
    const haEfectiva = semanas.map((_, i) => {
      if (i <= hoyIdx) return HA[i];
      const { base, vigentes } = nivelEn(i);
      return Math.max(0, base + vigentes.reduce((a, e) => a + (e.ha > 0 ? e.ha * rampa(i - e.eIdx, e) : e.ha), 0));
    });

    // Series de embolse (base/bajo/alto): real hasta hoy, proyectado después.
    const embolseVariante = (clave) => semanas.map((s, i) => (i <= hoyIdx ? E[i] : haEfectiva[i] * (statSemana(s.numeroSemana)?.[clave] ?? 0)));
    const embBase = embolseVariante('mean');
    const embLow = embolseVariante('p25');
    const embHigh = embolseVariante('p75');
    // Semana del último cierre vigente en la semana i (-1 si no hay): los embolses anteriores a ese cierre ya no se cosechan.
    const cierreVigente = (i) => {
      let c = -1;
      for (const e of entradas) if (e.cierre && e.eIdx <= i) c = e.eIdx;
      return c;
    };
    const aporta = (src, i) => src >= 0 && src >= cierreVigente(i);
    const racimos = (serieEmb, i) => EDADES.reduce((a, e) => a + (aporta(i - e + 1, i) ? serieEmb[i - e + 1] * tasas[e] : 0), 0);

    // Diagnóstico de hectáreas: si el embolse por hectárea reciente cae mucho frente al año anterior, probablemente
    // las hectáreas reales de hoy estén infladas (p. ej. un lote agregado contado dos veces).
    const embPorHa = (desde, hasta) => {
      let e = 0;
      let h = 0;
      let n = 0;
      for (let i = desde; i <= hasta; i++) {
        if (i < 0 || i >= semanas.length) continue;
        e += E[i];
        h += HA[i];
        n++;
      }
      return n > 0 && h > 0 ? e / h : 0; // embolses por hectárea por semana
    };
    const anioActual = hoyIdx >= 0 ? semanas[hoyIdx].anio : anio - 1;
    const idxAnterior = semanas.map((s, i) => (s.anio === anioActual - 1 && i <= hoyIdx ? i : -1)).filter((i) => i >= 0);
    const anteriorV = idxAnterior.length ? embPorHa(idxAnterior[0], idxAnterior[idxAnterior.length - 1]) : 0;
    const recienteV = embPorHa(hoyIdx - 25, hoyIdx);
    const haAnterior = idxAnterior.length ? idxAnterior.reduce((acc, i) => acc + HA[i], 0) / idxAnterior.length : 0;
    const diag = {
      anterior: r2(anteriorV),
      reciente: r2(recienteV),
      alerta: anteriorV > 0 && recienteV > 0 && recienteV < 0.75 * anteriorV && ha0Real > 1.25 * haAnterior,
    };
    if (diag.alerta && p.hectareasBasePorFinca[f.uuid] === undefined) alertasHa.push(f.nombre);

    let cajasAnuales = 0;
    for (const s of semanasAnio) {
      const i = s.idx;
      const real = i <= hoyIdx;
      const ratio = ratioSemana(s.numeroSemana);
      const rac = real && C[i] > 0 ? C[i] : racimos(embBase, i);
      const cajas = real && J[i] > 0 ? J[i] : rac * ratio;
      const cajasLow = real && J[i] > 0 ? J[i] : racimos(embLow, i) * ratio;
      const cajasHigh = real && J[i] > 0 ? J[i] : racimos(embHigh, i) * ratio;
      cajasAnuales += cajas;
      const realCompleta = real && C[i] > 0 && J[i] > 0;
      // Desglose de cómo salen los racimos de esta semana: cada semana de embolse (edad 8 a 12) aporta embolse × tasa.
      const detalleEdades = EDADES.map((e) => {
        const src = i - e + 1;
        if (src < 0) return { edad: e, semanaCodigo: null, embolse: 0, embolseReal: false, tasa: r4(tasas[e]), racimos: 0 };
        return {
          edad: e,
          semanaCodigo: semanas[src].codigo,
          embolse: Math.round(embBase[src]),
          embolseReal: src <= hoyIdx,
          tasa: r4(tasas[e]),
          racimos: aporta(src, i) ? Math.round(embBase[src] * tasas[e]) : 0,
          descartado: !aporta(src, i), // embolsado antes de un cierre: no se cosecha
        };
      });
      filas.push({
        fincaUuid: f.uuid,
        fincaCodigo: f.codigo,
        fincaNombre: f.nombre,
        semanaUuid: s.uuid,
        semanaCodigo: s.codigo,
        numeroSemana: s.numeroSemana,
        fechaInicio: iso(s.fechaInicio),
        real,
        hectareas: r2(haNominal[i]),
        hectareasEfectivas: r2(haEfectiva[i]),
        embolses: Math.round(embBase[i]),
        embolsesBajo: Math.round(embLow[i]),
        embolsesAlto: Math.round(embHigh[i]),
        racimos: Math.round(rac),
        // En semanas reales con cosecha y cajas registradas, el ratio es el realmente ocurrido (cajas ÷ racimos).
        ratio: r4(realCompleta ? J[i] / C[i] : ratio),
        ratioHistorico: r4(ratio),
        embolsesPorHa: r4(real ? (HA[i] > 0 ? E[i] / HA[i] : 0) : statSemana(s.numeroSemana)?.mean ?? 0),
        fuente: realCompleta ? 'real' : 'proyeccion',
        racimosDelDesglose: Math.round(racimos(embBase, i)),
        detalleEdades,
        cajas: Math.round(cajas),
        cajasBajo: Math.round(cajasLow),
        cajasAlto: Math.round(cajasHigh),
      });
    }

    historico[f.uuid] = {};
    for (const y of aniosGraf) {
      const lista = [];
      for (let i = 0; i < semanas.length; i++) {
        if (semanas[i].anio !== y || i > hoyIdx) continue;
        lista.push({ n: semanas[i].numeroSemana, e: Math.round(E[i]), ha: r2(HA[i]), c: Math.round(C[i]), j: Math.round(J[i]) });
      }
      if (lista.length) historico[f.uuid][y] = lista;
    }

    resumenFincas.push({
      fincaUuid: f.uuid,
      fincaNombre: f.nombre,
      aprovechamientoHistorico: r4(aprovechamientoHistorico),
      noCosechadoHistorico: r4(1 - aprovechamientoHistorico),
      aprovechamientoAplicado: r4(aprovechamientoAplicado),
      pctNoCosechadoAplicado: pctOverride ?? null,
      tasasPorEdad: Object.fromEntries(EDADES.map((e) => [e, r4(tasas[e])])),
      fuenteTasas: usaGlobal ? 'global' : 'finca',
      cajasAnuales: Math.round(cajasAnuales),
      hectareasActuales: r2(ha0Real),
      hectareasBase: r2(ha0),
      hectareasBaseManual: p.hectareasBasePorFinca[f.uuid] ?? null,
      embolsesPorHaSemanaAnterior: diag.anterior,
      embolsesPorHaSemanaReciente: diag.reciente,
      alertaHectareas: diag.alerta,
    });
  }

  // ── Totales por semana, mes y año (todas las fincas) ──
  const campos = ['hectareas', 'hectareasEfectivas', 'embolses', 'embolsesBajo', 'embolsesAlto', 'racimos', 'cajas', 'cajasBajo', 'cajasAlto'];
  const porSemana = semanasAnio.map((s) => {
    const rows = filas.filter((r) => r.semanaUuid === s.uuid);
    const t = { semanaCodigo: s.codigo, numeroSemana: s.numeroSemana, fechaInicio: iso(s.fechaInicio), real: s.idx <= hoyIdx };
    for (const c of campos) t[c] = r2(rows.reduce((a, r) => a + r[c], 0));
    return t;
  });
  const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * MS_DIA).getUTCMonth() + 1; // mes del jueves de la semana
  const porMes = [];
  for (let m = 1; m <= 12; m++) {
    const semanasMes = porSemana.filter((s) => mesDe(s.fechaInicio) === m);
    const t = { mes: m, semanas: semanasMes.length };
    for (const c of campos) t[c] = r2(semanasMes.reduce((a, s) => a + s[c], 0));
    // Las hectáreas son un nivel, no un flujo: se promedia en vez de sumar.
    for (const c of ['hectareas', 'hectareasEfectivas']) t[c] = semanasMes.length ? r2(semanasMes.reduce((a, s) => a + s[c], 0) / semanasMes.length) : 0;
    porMes.push(t);
  }
  const anual = {};
  for (const c of campos) anual[c] = r2(porSemana.reduce((a, s) => a + s[c], 0));
  anual.hectareas = porSemana.length ? r2(porSemana.reduce((a, s) => a + s.hectareas, 0) / porSemana.length) : 0;
  anual.hectareasEfectivas = porSemana.length ? r2(porSemana.reduce((a, s) => a + s.hectareasEfectivas, 0) / porSemana.length) : 0;

  // Total de todas las fincas (misma forma que historico[fincaUuid]).
  const historicoTotal = {};
  for (const porAnio of Object.values(historico)) {
    for (const [y, lista] of Object.entries(porAnio)) {
      historicoTotal[y] = historicoTotal[y] || new Map();
      for (const w of lista) {
        const t = historicoTotal[y].get(w.n) || { n: w.n, e: 0, ha: 0, c: 0, j: 0 };
        t.e += w.e;
        t.ha = r2(t.ha + w.ha);
        t.c += w.c;
        t.j += w.j;
        historicoTotal[y].set(w.n, t);
      }
    }
  }
  historico.TOTAL = Object.fromEntries(Object.entries(historicoTotal).map(([y, m]) => [y, [...m.values()].sort((a, b) => a.n - b.n)]));

  // ── Comparativo con años anteriores reales ──
  const aniosComp = [anio - 1, anio - 2];
  const totalReal = (anioComp, numeroSemana) => {
    let embolses = 0;
    let cajas = 0;
    semanas.forEach((s, i) => {
      if (s.anio !== anioComp || (numeroSemana !== undefined && s.numeroSemana !== numeroSemana)) return;
      for (const id of fincaIds) {
        embolses += emb.get(id)[i];
        cajas += caj.get(id)[i];
      }
    });
    return { embolses: Math.round(embolses), cajas: Math.round(cajas) };
  };
  const comparativo = {
    anios: aniosComp,
    porSemana: porSemana.map((s) => ({ numeroSemana: s.numeroSemana, valores: Object.fromEntries(aniosComp.map((a) => [a, totalReal(a, s.numeroSemana)])) })),
    anual: Object.fromEntries(aniosComp.map((a) => [a, totalReal(a)])),
    porMes: Array.from({ length: 12 }, (_, k) => {
      const m = k + 1;
      const valores = {};
      for (const a of aniosComp) {
        let embolses = 0;
        let cajas = 0;
        semanas.forEach((s, i) => {
          if (s.anio !== a || mesDe(iso(s.fechaInicio)) !== m) return;
          for (const id of fincaIds) {
            embolses += emb.get(id)[i];
            cajas += caj.get(id)[i];
          }
        });
        valores[a] = { embolses: Math.round(embolses), cajas: Math.round(cajas) };
      }
      return { mes: m, valores };
    }),
  };

  return {
    meta: {
      anio,
      semanasAnio: semanasAnio.length,
      semanaActual: hoyIdx >= 0 ? semanas[hoyIdx].codigo : null,
      params: p,
      fincasSinHistorial,
      anios: [...aniosHist].sort(),
      advertencias: [
        ...new Set(advertencias),
        ...(alertasHa.length ? [`Las hectáreas de hoy parecen infladas en ${alertasHa.join(', ')}: su embolse por hectárea reciente es mucho menor al del año anterior. Revisa las áreas de esas fincas o fija sus hectáreas base en el escenario.`] : []),
      ],
    },
    filas,
    porSemana,
    porMes,
    anual,
    aprovechamiento: resumenFincas,
    comparativo,
    historico,
  };
}

// ───────────────────────── Escenarios (CRUD) ─────────────────────────

// Reparto de las cajas por producto: kilos = cajas × tasa de conversión (peso de la caja de referencia, hoy 18.6) y cada producto
// recibe su % de esos kilos, que se convierten en cajas del producto con su peso neto.
const r2b = (n) => Math.round(n * 100) / 100;
// Cajas de un contenedor del producto: palets completos (cajas por palet × palets) más los minipalets (cajas por minipalet × cantidad).
const cajasDeContenedor = (p) => Number(p?.cajasPorPalet || 0) * Number(p?.cantidadPalets || 0) + Number(p?.cajasPorMinipalet || 0) * Number(p?.cantidadMinipalets || 0);
//   Modos por producto: CONTENEDORES (N contenedores por semana, con prioridad), PORCENTAJE (% de los kilos totales) y RESTO (lo que sobra).
//   Cajas por contenedor = cajas por palet × palets por contenedor del producto. Si los kilos de la semana no alcanzan para los
//   contenedores y porcentajes, se asigna en ese orden hasta agotarlos y la semana queda marcada como `faltante`.
// Un producto por contenedores aplica solo en las semanas que le tocan: cada N semanas desde la semana `desdeSemana` (N = 2: una sí y otra no).
export const aplicaEnSemana = (p, numeroSemana) => {
  const cada = Math.max(1, Number(p.cadaSemanas || 1));
  if (cada === 1 || numeroSemana === undefined) return true;
  const d = Number(numeroSemana) - Number(p.desdeSemana || 1);
  return ((d % cada) + cada) % cada === 0;
};

export function repartirKilos(kg, lista, numeroSemana) {
  let restante = kg;
  const cajas = {};
  let faltante = false;
  const asignar = (p, kgPedido) => {
    const kgReal = Math.max(0, Math.min(restante, kgPedido));
    if (kgPedido - kgReal > 0.0001) faltante = true;
    restante -= kgReal;
    cajas[p.uuid] = p.pesoNeto > 0 ? kgReal / p.pesoNeto : null;
  };
  for (const p of lista.filter((x) => x.modo === 'CONTENEDORES')) asignar(p, aplicaEnSemana(p, numeroSemana) ? Number(p.contenedores || 0) * Number(p.cajasPorContenedor || 0) * p.pesoNeto : 0);
  for (const p of lista.filter((x) => x.modo === 'PORCENTAJE')) asignar(p, (kg * Number(p.porcentaje || 0)) / 100);
  const resto = lista.find((x) => x.modo === 'RESTO');
  if (resto) {
    // El producto «resto» se redondea SIEMPRE hacia arriba a contenedores completos (cajas por contenedor × contenedores).
    const exactas = resto.pesoNeto > 0 ? Math.max(0, restante) / resto.pesoNeto : null;
    const porCont = Number(resto.cajasPorContenedor || 0);
    cajas[resto.uuid] = exactas !== null && porCont > 0 ? Math.ceil(exactas / porCont - 1e-9) * porCont : exactas;
    restante = 0;
  }
  return { cajas, sinAsignar: Math.max(0, restante), faltante };
}

export function repartoPorProducto(res, productos, tasa) {
  const lista = productos.map((p) => ({
    uuid: p.uuid,
    codigo: p.codigo,
    nombre: p.nombre,
    pesoNeto: Number(p.pesoNeto),
    modo: p.modo || 'PORCENTAJE',
    porcentaje: p.porcentaje === null || p.porcentaje === undefined ? null : Number(p.porcentaje),
    contenedores: p.contenedores === null || p.contenedores === undefined ? null : Number(p.contenedores),
    cajasPorContenedor: Number(p.cajasPorContenedor || 0),
    cadaSemanas: Number(p.cadaSemanas || 1),
    desdeSemana: Number(p.desdeSemana || 1),
  }));
  const semanas = res.porSemana.map((s) => {
    const kg = s.cajas * tasa;
    const rep = repartirKilos(kg, lista, s.numeroSemana);
    return {
      semanaCodigo: s.semanaCodigo,
      numeroSemana: s.numeroSemana,
      fechaInicio: s.fechaInicio,
      real: s.real,
      cajas: s.cajas,
      kg: r2b(kg),
      faltante: rep.faltante,
      sinAsignar: r2b(rep.sinAsignar),
      productos: Object.fromEntries(lista.map((p) => [p.uuid, rep.cajas[p.uuid] === null || rep.cajas[p.uuid] === undefined ? null : r2b(rep.cajas[p.uuid])])),
    };
  });
  return { tasaConversion: tasa, productos: lista, sumaPorcentajes: r2b(lista.filter((p) => p.modo === 'PORCENTAJE').reduce((a, p) => a + (p.porcentaje || 0), 0)), semanas };
}

const mapEscenario = (e, areas, productos) => ({
  uuid: e.uuid,
  nombre: e.nombre,
  anio: e.anio,
  descripcion: e.descripcion,
  params: normalizarParams(e.params),
  areas: (areas || []).map((a) => ({
    uuid: a.uuid,
    fincaUuid: a.finca?.uuid,
    fincaNombre: a.finca?.nombre,
    semanaUuid: a.semana?.uuid,
    semanaCodigo: a.semana?.codigo,
    hectareas: Number(a.hectareas),
    rampaPct: a.rampaPct === null || a.rampaPct === undefined ? null : Number(a.rampaPct),
    rampaSemanas: a.rampaSemanas === null || a.rampaSemanas === undefined ? null : Number(a.rampaSemanas),
    nota: a.nota,
  })),
  productos: [...(productos || [])]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id)
    .map((x) => ({
    uuid: x.producto?.uuid,
    codigo: x.producto?.codigo,
    nombre: x.producto?.nombre,
    pesoNeto: x.producto?.pesoNeto === null || x.producto?.pesoNeto === undefined ? null : Number(x.producto.pesoNeto),
    // Cajas por contenedor: las propias del escenario si las hay, o las del catálogo (cajas por palet × palets por contenedor).
    cajasCatalogo: cajasDeContenedor(x.producto),
    cajasContenedor: x.cajasContenedor === null || x.cajasContenedor === undefined ? null : Number(x.cajasContenedor),
    cajasPorContenedor: x.cajasContenedor === null || x.cajasContenedor === undefined ? cajasDeContenedor(x.producto) : Number(x.cajasContenedor),
    modo: x.modo || 'PORCENTAJE',
    cadaSemanas: Number(x.cadaSemanas || 1),
    desdeSemana: Number(x.desdeSemana || 1),
    porcentaje: x.porcentaje === null || x.porcentaje === undefined ? null : Number(x.porcentaje),
    contenedores: x.contenedores === null || x.contenedores === undefined ? null : Number(x.contenedores),
  })),
});

const cargarEscenario = async (uuid) => {
  const e = await ProyeccionEscenario.findOne({
    where: { uuid },
    include: [
      { model: ProyeccionArea, as: 'areas', include: [{ model: Finca, as: 'finca', attributes: ['uuid', 'nombre'] }, { model: Semana, as: 'semana', attributes: ['uuid', 'codigo'] }] },
      { model: ProyeccionProducto, as: 'productos', include: [{ model: Producto, as: 'producto', attributes: ['id', 'uuid', 'codigo', 'nombre', 'pesoNeto', 'cajasPorPalet', 'cantidadPalets', 'cajasPorMinipalet', 'cantidadMinipalets'] }] },
    ],
  });
  if (!e) throw ApiError.notFound('Escenario no encontrado');
  return e;
};

export const proyeccionService = {
  async listarEscenarios(query = {}) {
    const where = query.anio ? { anio: Number(query.anio) } : {};
    const filas = await ProyeccionEscenario.findAll({ where, order: [['anio', 'DESC'], ['nombre', 'ASC']] });
    return filas.map((e) => ({ uuid: e.uuid, nombre: e.nombre, anio: e.anio, descripcion: e.descripcion }));
  },

  async getEscenario(uuid) {
    const e = await cargarEscenario(uuid);
    return mapEscenario(e, e.areas, e.productos);
  },

  async crearEscenario({ nombre, anio, descripcion, params, copiarDeUuid }, actorId) {
    let paramsFinales = normalizarParams(params);
    let areasCopia = [];
    let productosCopia = [];
    if (copiarDeUuid) {
      const origen = await cargarEscenario(copiarDeUuid);
      paramsFinales = normalizarParams(origen.params);
      areasCopia = origen.areas;
      productosCopia = origen.productos;
    }
    const creado = await ProyeccionEscenario.create({ nombre, anio, descripcion: descripcion || null, params: paramsFinales, createdBy: actorId });
    if (areasCopia.length) {
      await ProyeccionArea.bulkCreate(areasCopia.map((a) => ({ escenarioId: creado.id, fincaId: a.fincaId, semanaId: a.semanaId, hectareas: a.hectareas, rampaPct: a.rampaPct, rampaSemanas: a.rampaSemanas, nota: a.nota, createdBy: actorId })));
    }
    if (productosCopia.length) {
      await ProyeccionProducto.bulkCreate(productosCopia.map((x) => ({ escenarioId: creado.id, productoId: x.productoId, modo: x.modo, porcentaje: x.porcentaje, contenedores: x.contenedores, cajasContenedor: x.cajasContenedor, cadaSemanas: x.cadaSemanas, desdeSemana: x.desdeSemana, orden: x.orden, createdBy: actorId })));
    }
    return this.getEscenario(creado.uuid);
  },

  async actualizarEscenario(uuid, { nombre, descripcion, params }, actorId) {
    const e = await cargarEscenario(uuid);
    const data = { updatedBy: actorId };
    if (nombre !== undefined) data.nombre = nombre;
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (params !== undefined) data.params = normalizarParams({ ...normalizarParams(e.params), ...params });
    await e.update(data);
    return this.getEscenario(uuid);
  },

  async eliminarEscenario(uuid, actorId) {
    const e = await cargarEscenario(uuid);
    await e.update({ deletedBy: actorId });
    await e.destroy();
  },

  // Reemplaza todo el plan de hectáreas nuevas del escenario: [{ fincaUuid, semanaUuid, hectareas, nota }].
  async guardarAreas(uuid, areas, actorId, user) {
    const e = await cargarEscenario(uuid);
    const fincas = await Finca.findAll({ where: { uuid: { [Op.in]: [...new Set(areas.map((a) => a.fincaUuid))] } }, attributes: ['id', 'uuid'] });
    const semanas = await Semana.findAll({ where: { uuid: { [Op.in]: [...new Set(areas.map((a) => a.semanaUuid))] } }, attributes: ['id', 'uuid'] });
    const fincaPorUuid = new Map(fincas.map((f) => [f.uuid, f]));
    const semanaPorUuid = new Map(semanas.map((s) => [s.uuid, s]));
    const filas = areas.map((a) => {
      const f = fincaPorUuid.get(a.fincaUuid);
      const s = semanaPorUuid.get(a.semanaUuid);
      if (!f) throw ApiError.badRequest('Finca no encontrada en el plan de hectáreas');
      if (!s) throw ApiError.badRequest('Semana no encontrada en el plan de hectáreas');
      assertFincaPermitida(user, f.id);
      return { escenarioId: e.id, fincaId: f.id, semanaId: s.id, hectareas: a.hectareas, rampaPct: a.rampaPct ?? null, rampaSemanas: a.rampaSemanas ?? null, nota: a.nota || null, createdBy: actorId };
    });
    await sequelize.transaction(async (transaction) => {
      await ProyeccionArea.destroy({ where: { escenarioId: e.id }, transaction });
      if (filas.length) await ProyeccionArea.bulkCreate(filas, { transaction });
    });
    return this.getEscenario(uuid);
  },

  // Carga masiva del plan de hectáreas. Columnas: finca (nombre o código), semana (SXX-YYYY), hectareas, nota.
  // Reemplaza el plan completo del escenario; con dryRun solo valida y devuelve el resumen y los errores por fila.
  async cargarAreasMasivo(uuid, file, { dryRun = false } = {}, actorId, user) {
    const e = await cargarEscenario(uuid);
    const filasArchivo = parseBulkFile(file);
    const fincas = await Finca.findAll({ attributes: ['id', 'uuid', 'codigo', 'nombre'], raw: true });
    const semanas = await Semana.findAll({ where: { anio: { [Op.gte]: e.anio - 1, [Op.lte]: e.anio + 1 } }, attributes: ['id', 'uuid', 'codigo', 'fechaInicio'], order: [['fechaInicio', 'ASC']], raw: true });
    const norm = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const fincaPor = new Map();
    for (const f of fincas) {
      fincaPor.set(norm(f.nombre), f);
      if (f.codigo) fincaPor.set(norm(f.codigo), f);
    }
    const semanaPor = new Map(semanas.map((s) => [norm(s.codigo), s]));
    const errores = [];
    const validas = [];
    filasArchivo.forEach((fila, i) => {
      const n = i + 2; // fila del Excel (1 = encabezados)
      const f = fincaPor.get(norm(fila.finca ?? fila.codigofinca));
      const s = semanaPor.get(norm(fila.semana));
      const ha = Number(String(fila.hectareas ?? fila.ha ?? '').replace(',', '.'));
      if (!f) return errores.push({ fila: n, error: 'Finca no encontrada' });
      if (!s) return errores.push({ fila: n, error: 'Semana no encontrada (usa el formato SXX-YYYY)' });
      if (!Number.isFinite(ha)) return errores.push({ fila: n, error: 'Hectáreas inválidas (un número; 0 = la finca deja de producir; negativo = baja)' });
      try {
        assertFincaPermitida(user, f.id);
      } catch {
        return errores.push({ fila: n, error: 'No tienes acceso a esa finca' });
      }
      // Altas (hectáreas positivas): la semana del archivo es la de PRIMERA COSECHA; la entrada (embolse) es 7 semanas antes.
      let semanaEntrada = s;
      if (ha > 0) {
        const idx = semanas.findIndex((x) => x.uuid === s.uuid);
        semanaEntrada = semanas[idx - SEMANAS_A_PRIMER_CORTE];
        if (!semanaEntrada) return errores.push({ fila: n, error: `La primera cosecha en ${s.codigo} exigiría embolsar ${SEMANAS_A_PRIMER_CORTE} semanas antes, fuera del calendario` });
      }
      const numOpcional = (v) => (v === '' || v === undefined || v === null ? null : Number(String(v).replace(',', '.')));
      const rampaPct = numOpcional(fila.arranque);
      const rampaSemanas = numOpcional(fila.semanas100);
      if ((rampaPct !== null && !(rampaPct >= 0 && rampaPct <= 100)) || (rampaSemanas !== null && !(Number.isInteger(rampaSemanas) && rampaSemanas >= 0 && rampaSemanas <= 104))) {
        return errores.push({ fila: n, error: 'Arranque debe estar entre 0 y 100, y semanas100 ser un entero entre 0 y 104' });
      }
      validas.push({ fincaUuid: f.uuid, semanaUuid: semanaEntrada.uuid, hectareas: ha, rampaPct, rampaSemanas, nota: fila.nota ? String(fila.nota) : null });
    });
    if (!dryRun && errores.length === 0 && validas.length) await this.guardarAreas(uuid, validas, actorId, user);
    return { total: filasArchivo.length, validas: validas.length, errores, aplicado: !dryRun && errores.length === 0 && validas.length > 0 };
  },

  async resultado(uuid, query, user) {
    const e = await cargarEscenario(uuid);
    const areas = e.areas.map((a) => ({ fincaId: a.fincaId, semanaId: a.semanaId, hectareas: a.hectareas, rampaPct: a.rampaPct, rampaSemanas: a.rampaSemanas }));
    const res = await calcularProyeccion({ anio: e.anio, params: e.params, areas }, user, { fincaUuids: query.fincaUuids });
    // La «caja 20kg» es la unidad de referencia del sistema: su peso real es la tasa de conversión configurada (18.6 por defecto).
    const tasa = await configuracionService.getTasaConversion();
    res.meta.tasaConversion = tasa;
    res.porProducto = repartoPorProducto(res, mapEscenario(e, [], e.productos).productos, tasa);
    return res;
  },

  // Reemplaza los productos del reparto (producto y % de los kilos). Deben sumar 100 y tener peso neto.
  async guardarProductos(uuid, items, actorId) {
    const e = await cargarEscenario(uuid);
    const uuids = items.map((x) => x.productoUuid);
    if (new Set(uuids).size !== uuids.length) throw ApiError.badRequest('Hay un producto repetido en el reparto');
    const productos = uuids.length ? await Producto.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['id', 'uuid', 'nombre', 'pesoNeto', 'cajasPorPalet', 'cantidadPalets', 'cajasPorMinipalet', 'cantidadMinipalets'] }) : [];
    const porUuid = new Map(productos.map((x) => [x.uuid, x]));
    for (const it of items) {
      const prod = porUuid.get(it.productoUuid);
      if (!prod) throw ApiError.badRequest('Producto no encontrado en el reparto');
      if (!(Number(prod.pesoNeto) > 0)) throw ApiError.badRequest(`El producto "${prod.nombre}" no tiene peso neto: configúralo en Maestros → Productos`);
      const modo = it.modo || 'PORCENTAJE';
      if (modo === 'PORCENTAJE' && !(Number(it.porcentaje) > 0)) throw ApiError.badRequest(`Escribe el % de los kilos de "${prod.nombre}"`);
      if (modo === 'CONTENEDORES') {
        if (!(Number(it.contenedores) > 0)) throw ApiError.badRequest(`Escribe cuántos contenedores por semana de "${prod.nombre}"`);
        if (!(Number(it.cajasContenedor) > 0) && !(cajasDeContenedor(prod) > 0)) throw ApiError.badRequest(`El producto "${prod.nombre}" no tiene cajas por palet y palets por contenedor: configúralos en Maestros → Productos o escribe las cajas por contenedor`);
      }
    }
    const modos = items.map((x) => x.modo || 'PORCENTAJE');
    if (modos.filter((m) => m === 'RESTO').length > 1) throw ApiError.badRequest('Solo un producto puede quedarse con el resto');
    const suma = items.filter((x) => (x.modo || 'PORCENTAJE') === 'PORCENTAJE').reduce((a, x) => a + Number(x.porcentaje), 0);
    const hayResto = modos.includes('RESTO');
    if (items.length > 0 && !hayResto) {
      // Sin «resto» todo el reparto debe ser por porcentaje y sumar 100.
      if (modos.includes('CONTENEDORES')) throw ApiError.badRequest('Con contenedores fijos agrega un producto «resto» para lo que sobre');
      if (Math.abs(suma - 100) > 0.01) throw ApiError.badRequest(`Los porcentajes deben sumar 100 % (suman ${r2b(suma)} %)`);
    }
    if (suma > 100.01) throw ApiError.badRequest(`Los porcentajes no pueden pasar de 100 % (suman ${r2b(suma)} %)`);
    await sequelize.transaction(async (transaction) => {
      await ProyeccionProducto.destroy({ where: { escenarioId: e.id }, transaction });
      if (items.length) {
        await ProyeccionProducto.bulkCreate(
          items.map((it, orden) => {
            const modo = it.modo || 'PORCENTAJE';
            return { escenarioId: e.id, productoId: porUuid.get(it.productoUuid).id, modo, porcentaje: modo === 'PORCENTAJE' ? it.porcentaje : null, contenedores: modo === 'CONTENEDORES' ? it.contenedores : null, cajasContenedor: modo === 'CONTENEDORES' ? it.cajasContenedor ?? null : null, cadaSemanas: modo === 'CONTENEDORES' ? it.cadaSemanas || 1 : 1, desdeSemana: modo === 'CONTENEDORES' ? it.desdeSemana || 1 : 1, orden, createdBy: actorId };
          }),
          { transaction },
        );
      }
    });
    return this.getEscenario(uuid);
  },

  async exportarExcel(uuid, query, user) {
    const { default: XLSX } = await import('xlsx');
    const e = await cargarEscenario(uuid);
    const res = await this.resultado(uuid, query, user);
    const etiquetaCajas = `Cajas ${res.meta.tasaConversion}`;
    const wb = XLSX.utils.book_new();
    const hoja = (nombre, filas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombre);

    hoja(
      'Por finca y semana',
      res.filas.map((r) => ({
        Finca: r.fincaNombre,
        Semana: r.semanaCodigo,
        Real: r.real ? 'Sí' : 'No',
        'Ha nominales': r.hectareas,
        'Ha efectivas': r.hectareasEfectivas,
        Embolses: r.embolses,
        'Embolses bajo': r.embolsesBajo,
        'Embolses alto': r.embolsesAlto,
        Racimos: r.racimos,
        Ratio: r.ratio,
        [etiquetaCajas]: r.cajas,
        'Cajas bajo': r.cajasBajo,
        'Cajas alto': r.cajasAlto,
      })),
    );
    if (res.porProducto.productos.length > 0) {
      hoja(
        'Por producto',
        res.porProducto.semanas.map((s) => ({
          Semana: s.semanaCodigo,
          [etiquetaCajas]: s.cajas,
          Kilos: s.kg,
          ...Object.fromEntries(res.porProducto.productos.map((p) => [`${p.nombre} (${p.modo === 'CONTENEDORES' ? `${p.contenedores} cont.${p.cadaSemanas > 1 ? ` cada ${p.cadaSemanas} sem. desde S${p.desdeSemana}` : '/sem.'}` : p.modo === 'RESTO' ? 'resto' : `${p.porcentaje} %`} · ${p.pesoNeto} kg)`, s.productos[p.uuid]])),
          'Sin asignar (kg)': s.sinAsignar,
          [`Asignado ${res.meta.tasaConversion} (convertido)`]: r2(res.porProducto.productos.reduce((a, p) => a + (s.productos[p.uuid] || 0) * p.pesoNeto, 0) / res.meta.tasaConversion),
          [`Diferencia ${res.meta.tasaConversion} (asignado - proyectado)`]: r2(res.porProducto.productos.reduce((a, p) => a + (s.productos[p.uuid] || 0) * p.pesoNeto, 0) / res.meta.tasaConversion - s.cajas),
        })),
      );
    }
    hoja('Totales semanales', res.porSemana.map((s) => ({ Semana: s.semanaCodigo, Real: s.real ? 'Sí' : 'No', Embolses: s.embolses, Racimos: s.racimos, [etiquetaCajas]: s.cajas, 'Cajas bajo': s.cajasBajo, 'Cajas alto': s.cajasAlto })));
    hoja('Totales mensuales', res.porMes.map((m) => ({ Mes: m.mes, Embolses: m.embolses, Racimos: m.racimos, [etiquetaCajas]: m.cajas, 'Cajas bajo': m.cajasBajo, 'Cajas alto': m.cajasAlto })));
    hoja(
      'Aprovechamiento',
      res.aprovechamiento.map((a) => ({
        Finca: a.fincaNombre,
        'Aprovechamiento histórico %': r2(a.aprovechamientoHistorico * 100),
        'No cosechado histórico %': r2(a.noCosechadoHistorico * 100),
        'No cosechado aplicado %': a.pctNoCosechadoAplicado ?? 'histórico',
        'Aprovechamiento aplicado %': r2(a.aprovechamientoAplicado * 100),
        'Cajas del año': a.cajasAnuales,
      })),
    );
    hoja(
      'Hectáreas nuevas',
      e.areas.map((a) => ({ Finca: a.finca?.nombre, 'Semana de embolse': a.semana?.codigo, Hectáreas: Number(a.hectareas), 'Arranque %': a.rampaPct ?? res.meta.params.rampaPct, 'Semanas hasta el 100 %': a.rampaSemanas ?? res.meta.params.rampaSemanas, Nota: a.nota })),
    );
    hoja(
      'Comparativo',
      res.comparativo.porSemana.map((s) => ({
        Semana: s.numeroSemana,
        ...Object.fromEntries(res.comparativo.anios.flatMap((a) => [[`Embolses ${a}`, s.valores[a].embolses], [`Cajas ${a}`, s.valores[a].cajas]])),
        'Embolses proyectado': res.porSemana.find((x) => x.numeroSemana === s.numeroSemana)?.embolses,
        'Cajas proyectado': res.porSemana.find((x) => x.numeroSemana === s.numeroSemana)?.cajas,
      })),
    );
    return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), nombre: `proyeccion-${e.anio}-${e.nombre}`.replace(/[^a-zA-Z0-9-_]+/g, '_') };
  },
};

export default proyeccionService;
