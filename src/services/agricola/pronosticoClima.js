import { QueryTypes } from 'sequelize';
import { sequelize } from '../../database/connection.js';

// Clima semanal para el pronóstico: temperatura, radiación, lluvia, humedad y grados-día (base 14 °C, el umbral del banano Cavendish)
// por semana de calendario, promediando las fincas del alcance. Fuente: open_meteo_clima_diaria (desde 2023).
export const TEMP_BASE_GDD = 14;
const MIN_DIAS_SEMANA = 5;
const VARIABLES_RATIO = (process.env.PRONOSTICO_CLIMA_VARS || 'rad,mm,hr,t').split(',');
// Desvíos extremos (fuera de lo visto en la historia) se recortan a ±Z desviaciones estándar para no extrapolar.
const Z_MAX = Number(process.env.PRONOSTICO_CLIMA_ZMAX ?? 1);
const HORIZONTES_ENTRENAMIENTO = [1, 4, 8, 12];
const REZAGO_RATIO = Number(process.env.PRONOSTICO_CLIMA_REZAGO ?? 12);
const VENTANA_RATIO = Number(process.env.PRONOSTICO_CLIMA_VENTANA ?? 8);
const RIDGE_LAMBDA = 20;
const AJUSTE_MAX = Number(process.env.PRONOSTICO_CLIMA_MAX ?? 0.08);
const MIN_MUESTRAS = 30;

export async function cargarClimaSemanal(semanaIds, fincaIds) {
  if (semanaIds.length === 0) return new Map();
  const filtroFinca = fincaIds && fincaIds.length > 0 ? 'WHERE finca_id IN (:fincaIds)' : '';
  const filas = await sequelize.query(
    `SELECT s.id AS semanaId, AVG(d.t) AS t, AVG(d.rad) AS rad, SUM(d.mm) AS mm, AVG(d.hr) AS hr,
            SUM(GREATEST(0, d.t - ${TEMP_BASE_GDD})) AS gdd, AVG(d.et0) AS et0, COUNT(*) AS dias
       FROM (SELECT fecha, AVG(temperatura) AS t, AVG(radiacion) AS rad, AVG(mm) AS mm, AVG(humedad_relativa) AS hr, AVG(et0) AS et0
               FROM open_meteo_clima_diaria ${filtroFinca} GROUP BY fecha) d
       JOIN semanas s ON d.fecha BETWEEN s.fecha_inicio AND s.fecha_fin
      WHERE s.id IN (:semanaIds)
      GROUP BY s.id`,
    { replacements: { semanaIds, fincaIds: fincaIds || [] }, type: QueryTypes.SELECT, logging: false },
  );
  const map = new Map();
  for (const f of filas) {
    if (Number(f.dias) < MIN_DIAS_SEMANA) continue;
    map.set(f.semanaId, { t: Number(f.t), rad: Number(f.rad), mm: Number(f.mm), hr: Number(f.hr), gdd: Number(f.gdd), et0: Number(f.et0) });
  }
  return map;
}

// Vista del clima "tal como se conocía" en un origen: semanas hasta el origen son reales; las posteriores se reemplazan por la climatología
// (promedio de la misma semana del año, ±1, en semanas ya observadas al origen) — así el backtest no usa clima del futuro.
export function crearVistaClima({ semanas, clima }) {
  const cacheClimatologia = new Map();
  const media = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);

  function climatologia(j, origen, v) {
    const key = `${semanas[j].numeroSemana}|${origen}|${v}`;
    if (cacheClimatologia.has(key)) return cacheClimatologia.get(key);
    const n = semanas[j].numeroSemana;
    const vals = [];
    for (let k = 0; k <= origen; k++) {
      const dist = Math.min(Math.abs(semanas[k].numeroSemana - n), 52 - Math.abs(semanas[k].numeroSemana - n));
      if (dist > 1) continue;
      const c = clima.get(semanas[k].id);
      if (c && Number.isFinite(c[v])) vals.push(c[v]);
    }
    const r = media(vals);
    cacheClimatologia.set(key, r);
    return r;
  }

  function valor(j, origen, v) {
    if (j < 0 || j >= semanas.length) return NaN;
    if (j <= origen) {
      const c = clima.get(semanas[j].id);
      return c && Number.isFinite(c[v]) ? c[v] : NaN;
    }
    return climatologia(j, origen, v);
  }

  function media52(origen, v) {
    const vals = [];
    for (let i = Math.max(0, origen - 51); i <= origen; i++) {
      const c = clima.get(semanas[i].id);
      if (c && Number.isFinite(c[v])) vals.push(c[v]);
    }
    return media(vals);
  }

  return { valor, media52, tieneDatos: clima.size > 0 };
}

function resolverRidge(X, Y, lambda) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  X.forEach((x, i) => {
    for (let a = 0; a < p; a++) {
      b[a] += x[a] * Y[i];
      for (let c = 0; c < p; c++) A[a][c] += x[a] * x[c];
    }
  });
  for (let a = 0; a < p; a++) A[a][a] += lambda;
  for (let i = 0; i < p; i++) {
    let m = i;
    for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]];
    [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < p; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < p; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const beta = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < p; c++) s -= A[i][c] * beta[c];
    beta[i] = s / A[i][i];
  }
  return beta;
}

// Ajuste del ratio por clima rezagado. Aprende, con lo ocurrido hasta hoy, cuánto se desvía el ratio de una semana T de su nivel reciente
// según la radiación, lluvia, humedad y temperatura de las 8 semanas que terminan 12 semanas antes (el llenado del fruto), medidas como
// desvío respecto al último año. `ratioGlobalEn(idx)`: ratio real cruzado del conjunto de fincas en esa semana (o null);
// `nivelEn(origen)`: nivel reciente con la información disponible en ese origen. Devuelve null si no hay muestras suficientes.
export function ajustarRatioClima({ vista, hoyIdx, ratioGlobalEn, nivelEn }) {
  if (!vista.tieneDatos) return null;
  const features = (T, origen) =>
    VARIABLES_RATIO.map((v) => {
      let s = 0;
      let c = 0;
      for (let j = T - REZAGO_RATIO - VENTANA_RATIO + 1; j <= T - REZAGO_RATIO; j++) {
        const x = vista.valor(j, origen, v);
        if (Number.isFinite(x)) {
          s += x;
          c++;
        }
      }
      const m52 = vista.media52(origen, v);
      return c > 0 && Number.isFinite(m52) ? s / c - m52 : NaN;
    });

  const X = [];
  const Y = [];
  for (const h of HORIZONTES_ENTRENAMIENTO) {
    for (let T2 = 30; T2 <= hoyIdx; T2++) {
      const t2 = T2 - h;
      if (t2 < 20) continue;
      const y = ratioGlobalEn(T2);
      if (y === null) continue;
      const base = nivelEn(t2);
      if (!base) continue;
      const f = features(T2, t2);
      if (f.some((z) => !Number.isFinite(z))) continue;
      X.push(f);
      Y.push(y - base);
    }
  }
  if (X.length < MIN_MUESTRAS) return null;
  const sd = VARIABLES_RATIO.map((_, i) => Math.sqrt(X.reduce((s, x) => s + x[i] ** 2, 0) / X.length) || 1);
  const beta = resolverRidge(
    X.map((x) => x.map((v, i) => v / sd[i])),
    Y,
    RIDGE_LAMBDA,
  );
  const baseHoy = nivelEn(hoyIdx);
  if (!baseHoy) return null;
  const cache = new Map();
  // Ajuste relativo (fracción del nivel reciente) para la semana T vista desde hoy.
  return (T) => {
    if (cache.has(T)) return cache.get(T);
    const f = features(T, hoyIdx);
    let rel = 0;
    if (f.every((z) => Number.isFinite(z))) {
      const adj = f.reduce((s, v, i) => s + beta[i] * (Math.max(-Z_MAX, Math.min(Z_MAX, v / sd[i]))), 0);
      rel = Math.max(-AJUSTE_MAX, Math.min(AJUSTE_MAX, adj)) / baseHoy;
    }
    cache.set(T, rel);
    return rel;
  };
}

// Edad térmica: con más calor la fruta madura antes. Redistribuye, dentro de las edades de corte, el peso de cada cinta según los grados-día
// acumulados desde su embolse frente a lo normal. `lambda` atenúa el efecto (0 = sin efecto, 1 = completo).
export function crearAjusteTermico({ semanas, clima, vista, hoyIdx, edades, lambda }) {
  const gdds = [];
  for (let i = 0; i <= hoyIdx; i++) {
    const c = clima.get(semanas[i].id);
    if (c && Number.isFinite(c.gdd)) gdds.push(c.gdd);
  }
  if (gdds.length < 52 || lambda <= 0) return null;
  const gddRef = gdds.reduce((a, b) => a + b, 0) / gdds.length;
  if (!(gddRef > 0)) return null;
  const cache = new Map();

  // Pesos por edad de la cinta `srcIdx`, a partir de la tasa base `rate` (objeto edad -> tasa).
  return function pesos(srcIdx, rate) {
    const key = `${srcIdx}|${edades.map((e) => rate[e].toFixed(6)).join(',')}`;
    if (cache.has(key)) return cache.get(key);
    const base = Object.fromEntries(edades.map((e) => [e, rate[e]]));
    const total = edades.reduce((a, e) => a + rate[e], 0);
    let resultado = base;
    if (total > 0) {
      const eMin = edades[0];
      const eMax = edades[edades.length - 1];
      const tasaEn = (x) => {
        const lo = Math.floor(x);
        const frac = x - lo;
        const a = lo >= eMin && lo <= eMax ? rate[lo] : 0;
        const b = lo + 1 >= eMin && lo + 1 <= eMax ? rate[lo + 1] : 0;
        return a * (1 - frac) + b * frac;
      };
      const nuevo = {};
      let completo = true;
      let acumulado = 0;
      let semanasSumadas = 0;
      for (let e = 1; e <= eMax; e++) {
        const g = vista.valor(srcIdx + e - 1, hoyIdx, 'gdd');
        if (!Number.isFinite(g)) {
          completo = false;
          break;
        }
        acumulado += g;
        semanasSumadas = e;
        if (e >= eMin) {
          const edadTermica = e + lambda * (acumulado / gddRef - semanasSumadas);
          nuevo[e] = tasaEn(edadTermica);
        }
      }
      const suma = completo ? edades.reduce((a, e) => a + (nuevo[e] || 0), 0) : 0;
      if (completo && suma > 0) resultado = Object.fromEntries(edades.map((e) => [e, ((nuevo[e] || 0) * total) / suma]));
    }
    cache.set(key, resultado);
    return resultado;
  };
}
