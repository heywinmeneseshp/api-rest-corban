// Genera la tabla de cuantiles de error histórico (5%/95%) que
// pronostico.service.js usa para construir el intervalo de confianza real
// (predictivo) de cada fila proyectada — y valida esa tabla contra un
// período de holdout NO usado para calcularla, para descartar sobreajuste
// (misma disciplina exigida para shrinkage/pooling: "cada mejora debe
// sobrevivir el backtest en más de una ventana antes de adoptarse").
//
// Por qué existe esto y no basta con el bootstrap de pronostico.service.js:
// el bootstrap (cohortes/semanas remuestreadas) mide solo la incertidumbre
// de ESTIMAR la tasa/ratio con los datos disponibles — no el error real de
// pronóstico, que además incluye el sesgo estructural del modelo (~-8%,
// medido y nunca resuelto — ver nota de MIN_COHORTES_FINCA en
// pronostico.service.js) y la variabilidad semana-a-semana genuina. Medido
// con backtest, el bootstrap solo lograba ~6-10% de cobertura real contra un
// objetivo de 90%. Este script en cambio usa la distribución empírica de
// errores h-semanas-adelante YA OBSERVADOS en el backtest — que por
// construcción incluye ambas fuentes de error.
//
// Uso:
//   node scripts/generar-cuantiles-error.mjs
//   PRONOSTICO_CUANTILES_TRAIN_DESDE=2024-07-01 PRONOSTICO_CUANTILES_TRAIN_HASTA=2025-08-01 \
//   PRONOSTICO_CUANTILES_TEST_DESDE=2025-08-15 PRONOSTICO_CUANTILES_TEST_HASTA=2026-05-04 \
//   node scripts/generar-cuantiles-error.mjs

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
import { Finca, Semana } from '../src/database/associations.js';
import { computeForecast } from '../src/services/agricola/pronostico.service.js';
import { MS_DIA, toISO, verificarSinFuga, fincasDeMuestra, fechasAsOfDate, actualPara } from './lib/backtest-common.mjs';

const SALIDA = fileURLToPath(new URL('../src/services/agricola/pronostico.errorQuantiles.json', import.meta.url));

const HORIZONTE_MAX = 13; // igual al SEMANAS_A_PROYECTAR de backtest-pronostico.mjs
const SEMANAS_A_PROYECTAR = HORIZONTE_MAX;
const PASO_DIAS = process.env.PRONOSTICO_BACKTEST_PASO_DIAS ? Number(process.env.PRONOSTICO_BACKTEST_PASO_DIAS) : 14;
const MIN_N_HORIZONTE = 20; // por debajo de esto, la cola 5%/95% no es confiable

const adminUser = { roles: ['Administrador'], fincaIds: [] };

// División train/test cronológica — el mismo principio que ya se exigió para
// validar shrinkage/pooling: la cobertura solo cuenta si se mide en fechas
// que el ajuste nunca vio.
const TRAIN_DESDE = process.env.PRONOSTICO_CUANTILES_TRAIN_DESDE || '2024-07-01';
const TRAIN_HASTA = process.env.PRONOSTICO_CUANTILES_TRAIN_HASTA || '2025-07-15';
const TEST_DESDE = process.env.PRONOSTICO_CUANTILES_TEST_DESDE || '2025-08-01';
const TEST_HASTA = process.env.PRONOSTICO_CUANTILES_TEST_HASTA || toISO(new Date(Date.now() - 90 * MS_DIA));

function percentil(sorted, p) {
  const n = sorted.length;
  if (n === 0) return null;
  const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  return sorted[idx];
}

// Recolecta, por horizonte (1..HORIZONTE_MAX), el error relativo respecto a
// la PREDICCIÓN (no respecto al actual — así el cuantil se aplica
// directamente como factor multiplicativo sobre cualquier predicción nueva):
//   e = (actual - prediccion) / prediccion
async function recolectarErrores(desde, hasta) {
  const muestra = await fincasDeMuestra();
  const asOfDates = fechasAsOfDate(desde, hasta, PASO_DIAS);
  const objetivos = [
    { label: 'GLOBAL', fincaUuids: undefined },
    ...muestra.map((f) => ({ label: `${f.codigo} ${f.nombre}`, fincaUuids: f.uuid })),
  ];

  const erroresPorHorizonte = new Map();
  for (let h = 1; h <= HORIZONTE_MAX; h++) erroresPorHorizonte.set(h, []);

  let ok = 0;
  let errores = 0;
  for (const asOfDate of asOfDates) {
    for (const obj of objetivos) {
      let resultado;
      try {
        resultado = await computeForecast(
          { fincaUuids: obj.fincaUuids, semanas: String(SEMANAS_A_PROYECTAR) },
          adminUser,
          asOfDate,
        );
        await verificarSinFuga(resultado.rows, asOfDate);
      } catch (err) {
        errores++;
        console.error(`  [error] ${obj.label} asOf=${toISO(asOfDate)}: ${err.message}`);
        continue;
      }
      ok++;

      const uuidsFincas = resultado.meta.fincas.map((f) => f.uuid);
      const fincasDb = await Finca.findAll({ where: { uuid: { [Op.in]: uuidsFincas } }, attributes: ['id'] });
      const idsReales = fincasDb.map((f) => f.id);
      if (idsReales.length === 0) continue;

      for (let h = 1; h <= HORIZONTE_MAX; h++) {
        const fila = resultado.rows[h];
        if (!fila || fila.real || fila.cajas20kg <= 0) continue;

        const semanaRow = await Semana.findOne({ where: { uuid: fila.semanaUuid }, attributes: ['id'] });
        if (!semanaRow) continue;
        const actual = await actualPara(idsReales, semanaRow.id);
        if (actual.racimos <= 0 || actual.cajas <= 0) continue;

        const e = (actual.cajas - fila.cajas20kg) / fila.cajas20kg;
        erroresPorHorizonte.get(h).push(e);
      }
    }
  }
  console.log(`  corridas: ${ok} ok, ${errores} con error`);
  return erroresPorHorizonte;
}

function calcularCuantiles(erroresPorHorizonte) {
  const tabla = {};
  for (let h = 1; h <= HORIZONTE_MAX; h++) {
    const arr = [...erroresPorHorizonte.get(h)].sort((a, b) => a - b);
    if (arr.length < MIN_N_HORIZONTE) {
      tabla[h] = null; // se completa con fallback (horizonte más próximo) más abajo
      continue;
    }
    tabla[h] = { lo: percentil(arr, 0.05), hi: percentil(arr, 0.95), n: arr.length };
  }
  // Fallback para horizontes con N insuficiente: usar el horizonte válido más
  // cercano (el error crece con el horizonte, así que el vecino es la mejor
  // aproximación disponible sin inventar un modelo paramétrico).
  const validos = Object.keys(tabla).map(Number).filter((h) => tabla[h] !== null);
  for (let h = 1; h <= HORIZONTE_MAX; h++) {
    if (tabla[h] !== null) continue;
    if (validos.length === 0) continue;
    const masCercano = validos.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a));
    tabla[h] = { ...tabla[masCercano], n: tabla[masCercano].n, fallbackDe: masCercano };
  }
  return tabla;
}

async function validarHoldout(tabla, desde, hasta) {
  const muestra = await fincasDeMuestra();
  const asOfDates = fechasAsOfDate(desde, hasta, PASO_DIAS);
  const objetivos = [
    { label: 'GLOBAL', fincaUuids: undefined },
    ...muestra.map((f) => ({ label: `${f.codigo} ${f.nombre}`, fincaUuids: f.uuid })),
  ];

  const porHorizonte = new Map();
  for (let h = 1; h <= HORIZONTE_MAX; h++) porHorizonte.set(h, { n: 0, cubiertas: 0 });

  for (const asOfDate of asOfDates) {
    for (const obj of objetivos) {
      let resultado;
      try {
        resultado = await computeForecast(
          { fincaUuids: obj.fincaUuids, semanas: String(SEMANAS_A_PROYECTAR) },
          adminUser,
          asOfDate,
        );
        await verificarSinFuga(resultado.rows, asOfDate);
      } catch {
        continue;
      }

      const uuidsFincas = resultado.meta.fincas.map((f) => f.uuid);
      const fincasDb = await Finca.findAll({ where: { uuid: { [Op.in]: uuidsFincas } }, attributes: ['id'] });
      const idsReales = fincasDb.map((f) => f.id);
      if (idsReales.length === 0) continue;

      for (let h = 1; h <= HORIZONTE_MAX; h++) {
        const fila = resultado.rows[h];
        if (!fila || fila.real || fila.cajas20kg <= 0) continue;
        const semanaRow = await Semana.findOne({ where: { uuid: fila.semanaUuid }, attributes: ['id'] });
        if (!semanaRow) continue;
        const actual = await actualPara(idsReales, semanaRow.id);
        if (actual.racimos <= 0 || actual.cajas <= 0) continue;

        const q = tabla[h];
        if (!q) continue;
        const ciLow = fila.cajas20kg * (1 + q.lo);
        const ciHigh = fila.cajas20kg * (1 + q.hi);
        const stats = porHorizonte.get(h);
        stats.n++;
        if (actual.cajas >= ciLow && actual.cajas <= ciHigh) stats.cubiertas++;
      }
    }
  }
  return porHorizonte;
}

async function main() {
  console.log(`TRAIN: ${TRAIN_DESDE} .. ${TRAIN_HASTA}`);
  console.log(`TEST (holdout, no visto por el ajuste): ${TEST_DESDE} .. ${TEST_HASTA}`);
  console.log('');

  console.log('Recolectando errores del período TRAIN...');
  const erroresTrain = await recolectarErrores(TRAIN_DESDE, TRAIN_HASTA);
  const tabla = calcularCuantiles(erroresTrain);

  console.log('\n=== Cuantiles de error por horizonte (TRAIN) ===');
  const filasTabla = [];
  for (let h = 1; h <= HORIZONTE_MAX; h++) {
    const q = tabla[h];
    filasTabla.push({
      Horizonte: `${h} sem`,
      N: q.n,
      'Lo (5%)': q.lo != null ? `${(q.lo * 100).toFixed(1)}%` : '—',
      'Hi (95%)': q.hi != null ? `${(q.hi * 100).toFixed(1)}%` : '—',
      Fallback: q.fallbackDe ? `de horizonte ${q.fallbackDe}` : '',
    });
  }
  console.table(filasTabla);

  console.log('Validando cobertura en el período TEST (holdout, cuantiles fijos del TRAIN)...');
  const coverageTest = await validarHoldout(tabla, TEST_DESDE, TEST_HASTA);

  console.log('\n=== Cobertura empírica en TEST (objetivo: ~90%) ===');
  const filasCoverage = [];
  let nTotal = 0;
  let cubiertasTotal = 0;
  for (let h = 1; h <= HORIZONTE_MAX; h++) {
    const { n, cubiertas } = coverageTest.get(h);
    nTotal += n;
    cubiertasTotal += cubiertas;
    filasCoverage.push({
      Horizonte: `${h} sem`,
      N: n,
      'Coverage %': n > 0 ? ((cubiertas / n) * 100).toFixed(1) : 'n/a',
    });
  }
  console.table(filasCoverage);
  console.log(`Coverage global TEST: ${nTotal > 0 ? ((cubiertasTotal / nTotal) * 100).toFixed(1) : 'n/a'}% (N=${nTotal})`);

  const salida = {
    generadoEn: new Date().toISOString(),
    trainDesde: TRAIN_DESDE,
    trainHasta: TRAIN_HASTA,
    coverageHoldout: nTotal > 0 ? cubiertasTotal / nTotal : null,
    coverageHoldoutN: nTotal,
    horizonteMax: HORIZONTE_MAX,
    cuantiles: Object.fromEntries(
      Object.entries(tabla).map(([h, q]) => [h, { lo: q.lo, hi: q.hi, n: q.n }]),
    ),
  };
  writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n');
  console.log(`\nGuardado: ${SALIDA}`);
}

main()
  .then(() => process.exitCode = 0)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
