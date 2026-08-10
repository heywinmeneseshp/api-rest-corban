// Backtest POR ETAPAS del modelo de Pronóstico de Cajas — herramienta
// OFICIAL de validación del proyecto (ver VALIDACION_FINAL_MODELO_v1.md,
// sección 9: ninguna mejora se adopta sin pasar por este script).
//
// A diferencia de una versión anterior de este script, que solo medía el
// resultado final (cajas), este mide las CUATRO etapas de la cadena de
// pronóstico por separado — cada una con MAPE, Bias y N, por horizonte:
//   1. Racimos embolsados (embolseProyectado)   — ¿se proyecta bien el
//      volumen de embolse de semanas futuras?
//   2. Racimos cosechados (racimosCosechados)    — ¿se proyecta bien cuánto
//      de ese embolse (real o proyectado) se convierte en cosecha?
//   3. Ratio cajas/racimo (ratio)                — ¿se proyecta bien el
//      rendimiento?
//   4. Cajas 20kg (cajas20kg, resultado final)   — el producto de 2 y 3.
//
// Objetivo deliberadamente simple: identificar cuál de los cuatro
// componentes aporta la mayor parte del error, no reconstruir
// matemáticamente cómo se propaga (eso quedó descartado — el diagnóstico
// que importa es "cuál componente es el cuello de botella", no una
// descomposición exacta del bias final).
//
// Uso: node scripts/backtest-pronostico.mjs
//
// Ver plan: C:\Users\onides\.claude\plans\breezy-juggling-cook.md
// Ver memoria técnica: VALIDACION_FINAL_MODELO_v1.md

import 'dotenv/config';
import { Op } from 'sequelize';
import { Finca, Semana } from '../src/database/associations.js';
import { computeForecast } from '../src/services/agricola/pronostico.service.js';
import {
  MS_DIA,
  toISO,
  verificarSinFuga,
  fincasDeMuestra,
  fechasAsOfDate,
  actualPara,
  embolseActualPara,
} from './lib/backtest-common.mjs';

const HORIZONTES = [1, 4, 8, 12];
const SEMANAS_A_PROYECTAR = 13; // rows[0] es la semana actual (real); rows[h] = h semanas adelante
const PASO_DIAS = process.env.PRONOSTICO_BACKTEST_PASO_DIAS ? Number(process.env.PRONOSTICO_BACKTEST_PASO_DIAS) : 28;

const adminUser = { roles: ['Administrador'], fincaIds: [] };

const DESDE = process.env.PRONOSTICO_BACKTEST_DESDE || '2024-07-01';
const HASTA = process.env.PRONOSTICO_BACKTEST_HASTA || toISO(new Date(Date.now() - 90 * MS_DIA));

function errorPct(pred, actual) {
  if (!(actual > 0)) return null;
  return (pred - actual) / actual;
}

function agregar(obs) {
  const n = obs.length;
  if (n === 0) return { n: 0, mape: null, bias: null };
  const sumAbs = obs.reduce((a, e) => a + Math.abs(e), 0);
  const sumBias = obs.reduce((a, e) => a + e, 0);
  return { n, mape: (sumAbs / n) * 100, bias: (sumBias / n) * 100 };
}

function fmt(v, dec = 1) {
  return v == null ? '—' : v.toFixed(dec);
}

async function main() {
  const muestra = await fincasDeMuestra();
  const asOfDates = fechasAsOfDate(DESDE, HASTA, PASO_DIAS);

  console.log(`Fincas de muestra: ${muestra.map((f) => `${f.codigo} ${f.nombre} (vol=${f.volumen})`).join(', ')}`);
  console.log(
    `Fechas asOfDate: ${asOfDates.length} (cada ${PASO_DIAS} días, desde ${toISO(asOfDates[0])} hasta ${toISO(asOfDates[asOfDates.length - 1])})`,
  );
  console.log('');

  const objetivos = [
    { label: 'GLOBAL', fincaUuids: undefined },
    ...muestra.map((f) => ({ label: `${f.codigo} ${f.nombre}`, fincaUuids: f.uuid })),
  ];

  // obsPorHorizonte[h] = { embolse: [errPct...], cosechados: [...], ratio: [...], cajas: [...] }
  const obsPorHorizonte = new Map();
  for (const h of HORIZONTES) {
    obsPorHorizonte.set(h, { embolse: [], cosechados: [], ratio: [], cajas: [] });
  }

  let totalCorridas = 0;
  let totalErrores = 0;

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
        totalErrores++;
        console.error(`  [error] ${obj.label} asOf=${toISO(asOfDate)}: ${err.message}`);
        continue;
      }
      totalCorridas++;

      const uuidsFincas = resultado.meta.fincas.map((f) => f.uuid);
      const fincasDb = await Finca.findAll({ where: { uuid: { [Op.in]: uuidsFincas } }, attributes: ['id'] });
      const idsReales = fincasDb.map((f) => f.id);
      if (idsReales.length === 0) continue;

      for (const horizonte of HORIZONTES) {
        const fila = resultado.rows[horizonte];
        if (!fila || fila.real) continue;

        const semanaRow = await Semana.findOne({ where: { uuid: fila.semanaUuid }, attributes: ['id'] });
        if (!semanaRow) continue;

        const [actual, embolseActual] = await Promise.all([
          actualPara(idsReales, semanaRow.id),
          embolseActualPara(idsReales, semanaRow.id),
        ]);

        const bucket = obsPorHorizonte.get(horizonte);

        // Etapa 1: racimos embolsados — fila.embolseProyectado siempre es una
        // proyección genuina en este punto (la semana de embolse de la fila
        // propia es siempre posterior a asOfDate para horizonte >= 1).
        const eEmbolse = errorPct(fila.embolseProyectado, embolseActual);
        if (eEmbolse != null) bucket.embolse.push(eEmbolse);

        // Etapa 2: racimos cosechados
        const eCosechados = errorPct(fila.racimosCosechados, actual.racimos);
        if (eCosechados != null) bucket.cosechados.push(eCosechados);

        // Etapa 3: ratio cajas/racimo
        let eRatio = null;
        if (actual.racimos > 0 && actual.cajas > 0) {
          const ratioActual = actual.cajas / actual.racimos;
          eRatio = errorPct(fila.ratio, ratioActual);
          if (eRatio != null) bucket.ratio.push(eRatio);
        }

        // Etapa 4: cajas (resultado final)
        const eCajas = errorPct(fila.cajas20kg, actual.cajas);
        if (eCajas != null) bucket.cajas.push(eCajas);
      }
    }
  }

  console.log(`\nCorridas: ${totalCorridas} ok, ${totalErrores} con error.\n`);

  function tablaEtapa(clave) {
    return HORIZONTES.map((h) => {
      const { n, mape, bias } = agregar(obsPorHorizonte.get(h)[clave]);
      return { Horizonte: `${h} sem`, N: n, 'MAPE %': fmt(mape), 'Bias %': fmt(bias) };
    });
  }

  console.log('=== 1. ¿Qué tan bien pronosticamos los racimos EMBOLSADOS? ===');
  console.table(tablaEtapa('embolse'));

  console.log('=== 2. ¿Qué tan bien pronosticamos los racimos COSECHADOS? ===');
  console.table(tablaEtapa('cosechados'));

  console.log('=== 3. ¿Qué tan bien pronosticamos el RATIO cajas/racimo? ===');
  console.table(tablaEtapa('ratio'));

  console.log('=== 4. ¿Qué tan bien pronosticamos las CAJAS (resultado final)? ===');
  console.table(tablaEtapa('cajas'));

  process.exitCode = totalErrores > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
