// Diagnóstico exploratorio del histórico de EMBOLSE — paso previo obligatorio
// antes de tocar el algoritmo de proyección de embolse (identificado como el
// cuello de botella del modelo, ver backtest por etapas en
// scripts/backtest-pronostico.mjs y VALIDACION_FINAL_MODELO_v1.md).
//
// No implementa ningún modelo — solo mide: tendencia, estacionalidad anual,
// variación semanal, diferencias entre fincas, autocorrelación, persistencia,
// eventos atípicos, y relación con semana del año. Escribe un JSON con todos
// los números (para construir el documento de hallazgos con precisión) y
// también imprime tablas resumen en consola.
//
// Uso: DB_LOGGING=false node scripts/analizar-embolse.mjs

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
import { Finca, Semana } from '../src/database/associations.js';
import { racimoMovimientoRepository } from '../src/repositories/agricola/racimoMovimiento.repository.js';

const SALIDA = fileURLToPath(new URL('./_analisis_embolse.json', import.meta.url));

// --- Utilidades estadísticas (sin dependencias nuevas) ----------------------

function media(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
function varianza(arr) {
  const m = media(arr);
  if (m == null || arr.length < 2) return null;
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
}
function desvio(arr) {
  const v = varianza(arr);
  return v != null ? Math.sqrt(v) : null;
}
function percentil(arrOrdenado, p) {
  const n = arrOrdenado.length;
  if (n === 0) return null;
  const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  return arrOrdenado[idx];
}
function mediana(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return percentil(s, 0.5);
}
function mad(arr) {
  // Median Absolute Deviation — medida robusta de dispersión, no se deja
  // arrastrar por los mismos outliers que se están buscando.
  const med = mediana(arr);
  const desvios = arr.map((x) => Math.abs(x - med));
  return mediana(desvios);
}
// Regresión lineal simple (mínimos cuadrados) y = a + b*x
function regresionLineal(xs, ys) {
  const n = xs.length;
  if (n < 2) return { a: null, b: null, r2: null };
  const mx = media(xs);
  const my = media(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : null;
  return { a, b, r2 };
}
function correlacion(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const { r2, b } = regresionLineal(x, y);
  if (r2 == null) return null;
  return Math.sign(b) * Math.sqrt(r2);
}
// Autocorrelación muestral en el lag k (Pearson entre la serie y su propio
// desfase — fórmula estándar de series de tiempo, no la de Pearson genérica
// porque usa la MISMA media/varianza global de la serie completa, no de cada
// sub-segmento, que es la convención correcta para ACF).
function acf(serie, maxLag) {
  const n = serie.length;
  const m = media(serie);
  const denom = serie.reduce((a, x) => a + (x - m) ** 2, 0);
  const resultado = [];
  for (let k = 1; k <= maxLag; k++) {
    if (n - k < 5) break;
    let num = 0;
    for (let t = 0; t < n - k; t++) num += (serie[t] - m) * (serie[t + k] - m);
    resultado.push({ lag: k, acf: denom > 0 ? num / denom : null });
  }
  return resultado;
}
// Eta-cuadrado: fracción de la varianza total explicada por agrupar por
// semana-del-año — análogo a un R² de ANOVA de un factor.
function etaCuadrado(valores, grupos) {
  const gruposUnicos = [...new Set(grupos)];
  const mGlobal = media(valores);
  let ssTotal = 0;
  let ssEntre = 0;
  for (let i = 0; i < valores.length; i++) ssTotal += (valores[i] - mGlobal) ** 2;
  for (const g of gruposUnicos) {
    const vs = valores.filter((_, i) => grupos[i] === g);
    const mg = media(vs);
    ssEntre += vs.length * (mg - mGlobal) ** 2;
  }
  return ssTotal > 0 ? ssEntre / ssTotal : null;
}

// --- Carga de datos -----------------------------------------------------

async function main() {
  // Historia operativa real confirmada (ver VALIDACION_FINAL_MODELO_v1.md,
  // hallazgo 4.7): el calendario existe desde 2021, pero el seguimiento real
  // (racimo_movimientos) recién empieza 2023-01-02 — analizar desde ahí, no
  // desde que existe el calendario, o los estadísticos quedan contaminados
  // por ~2 años de ceros que no son "embolse bajo", son "no había sistema".
  const DESDE = '2023-01-02';
  const HASTA = new Date().toISOString().slice(0, 10);

  const semanas = await Semana.findAll({
    where: { fechaInicio: { [Op.gte]: DESDE, [Op.lte]: HASTA } },
    attributes: ['id', 'codigo', 'anio', 'numeroSemana', 'fechaInicio'],
    order: [['fechaInicio', 'ASC']],
    raw: true,
  });
  const semanaIds = semanas.map((s) => s.id);

  const fincas = await Finca.findAll({ where: { estado: true }, attributes: ['id', 'uuid', 'codigo', 'nombre'] });
  const fincaIds = fincas.map((f) => f.id);

  const embolseMap = await racimoMovimientoRepository.getEmbolsePorFincaYSemana({
    fincaIds,
    semanaEmbolseIds: semanaIds,
  });

  // Serie global (suma de todas las fincas) y por finca, alineadas al mismo
  // eje de semanas (0 donde no hay dato, para no romper el índice temporal).
  const serieGlobal = semanas.map((s) => {
    let total = 0;
    for (const fid of fincaIds) total += embolseMap.get(`${fid}-${s.id}`) || 0;
    return total;
  });
  const seriesPorFinca = new Map();
  for (const f of fincas) {
    seriesPorFinca.set(
      f.id,
      semanas.map((s) => embolseMap.get(`${f.id}-${s.id}`) || 0),
    );
  }

  // Recortar semanas iniciales/finales sin ningún dato (antes de que la
  // finca existiera, o semanas futuras todavía sin embolsar) — mismo
  // criterio de "recorte de huecos iniciales" ya usado en Holt-Winters.
  const primerIdxConDato = serieGlobal.findIndex((v) => v > 0);
  let ultimoIdxConDato = serieGlobal.length - 1;
  while (ultimoIdxConDato > 0 && serieGlobal[ultimoIdxConDato] === 0) ultimoIdxConDato--;
  const semanasAnalisis = semanas.slice(primerIdxConDato, ultimoIdxConDato + 1);
  const serieGlobalAnalisis = serieGlobal.slice(primerIdxConDato, ultimoIdxConDato + 1);

  console.log(`Semanas en el análisis: ${semanasAnalisis.length} (${semanasAnalisis[0].codigo} a ${semanasAnalisis[semanasAnalisis.length - 1].codigo})`);

  // --- 1. Tendencia ---------------------------------------------------------
  const xIdx = serieGlobalAnalisis.map((_, i) => i);
  const tendenciaGlobal = regresionLineal(xIdx, serieGlobalAnalisis);
  // Por año, para ver si la tendencia es estable o cambia de régimen.
  const aniosPresentes = [...new Set(semanasAnalisis.map((s) => s.anio))].sort();
  const tendenciaPorAnio = aniosPresentes.map((anio) => {
    const idxAnio = semanasAnalisis.map((s, i) => (s.anio === anio ? i : -1)).filter((i) => i >= 0);
    const ys = idxAnio.map((i) => serieGlobalAnalisis[i]);
    const xs = idxAnio.map((_, i) => i);
    const { b, r2 } = regresionLineal(xs, ys);
    return { anio, semanas: idxAnio.length, promedioSemanal: media(ys), pendienteSemanal: b, r2 };
  });

  console.log('\n=== 1. TENDENCIA (global) ===');
  console.log(
    `Pendiente: ${tendenciaGlobal.b?.toFixed(1)} racimos/semana adicionales en promedio, R²=${tendenciaGlobal.r2?.toFixed(3)}`,
  );
  console.table(tendenciaPorAnio.map((t) => ({ ...t, promedioSemanal: t.promedioSemanal?.toFixed(0), pendienteSemanal: t.pendienteSemanal?.toFixed(1), r2: t.r2?.toFixed(3) })));

  // --- 2. Estacionalidad anual (por semana de calendario) -------------------
  const porSemanaCalendario = new Map(); // numeroSemana -> [valores]
  for (let i = 0; i < semanasAnalisis.length; i++) {
    const ns = Math.min(52, semanasAnalisis[i].numeroSemana); // S53 se pliega sobre 52
    if (!porSemanaCalendario.has(ns)) porSemanaCalendario.set(ns, []);
    porSemanaCalendario.get(ns).push(serieGlobalAnalisis[i]);
  }
  const estacionalidad = [...porSemanaCalendario.entries()]
    .map(([ns, vals]) => ({
      numeroSemana: ns,
      n: vals.length,
      media: media(vals),
      desvio: desvio(vals),
      cv: desvio(vals) != null && media(vals) > 0 ? desvio(vals) / media(vals) : null,
    }))
    .sort((a, b) => a.numeroSemana - b.numeroSemana);

  // Residuos respecto a la tendencia lineal (para separar estacionalidad de
  // tendencia — sin esto, la estacionalidad quedaría "contaminada" por el
  // crecimiento general).
  const residuosTendencia = serieGlobalAnalisis.map((v, i) => v - (tendenciaGlobal.a + tendenciaGlobal.b * i));
  const gruposSemana = semanasAnalisis.map((s) => Math.min(52, s.numeroSemana));
  const eta2Estacional = etaCuadrado(residuosTendencia, gruposSemana);

  // Índice estacional (media del residuo de tendencia por semana-del-año) y
  // línea base tendencia+estacionalidad — necesaria para que "eventos
  // atípicos" (punto 7) detecte anomalías REALES, no la temporada alta
  // reapareciendo cada año como si fuera un evento aislado.
  const sumaResiduoPorSemana = new Map();
  const nPorSemana = new Map();
  for (let i = 0; i < semanasAnalisis.length; i++) {
    const ns = Math.min(52, semanasAnalisis[i].numeroSemana);
    sumaResiduoPorSemana.set(ns, (sumaResiduoPorSemana.get(ns) || 0) + residuosTendencia[i]);
    nPorSemana.set(ns, (nPorSemana.get(ns) || 0) + 1);
  }
  const indiceEstacionalPorSemana = new Map(
    [...sumaResiduoPorSemana.entries()].map(([ns, suma]) => [ns, suma / nPorSemana.get(ns)]),
  );
  const residuosEstacionales = semanasAnalisis.map((s, i) => {
    const ns = Math.min(52, s.numeroSemana);
    return residuosTendencia[i] - indiceEstacionalPorSemana.get(ns);
  });

  const semanasOrdenadasPorMedia = [...estacionalidad].sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  console.log('\n=== 2. ESTACIONALIDAD ANUAL ===');
  console.log(`Fracción de la varianza (tras remover tendencia) explicada por semana-del-año: η² = ${eta2Estacional?.toFixed(3)}`);
  console.log('Top 5 semanas más altas:', semanasOrdenadasPorMedia.slice(0, 5).map((s) => `S${s.numeroSemana} (${s.media.toFixed(0)})`).join(', '));
  console.log('Top 5 semanas más bajas:', semanasOrdenadasPorMedia.slice(-5).map((s) => `S${s.numeroSemana} (${s.media.toFixed(0)})`).join(', '));

  // Estabilidad del patrón estacional entre años: correlación del perfil
  // semana-del-año de cada par de años consecutivos.
  const perfilPorAnio = new Map();
  for (const anio of aniosPresentes) {
    const perfil = new Array(53).fill(null);
    for (let i = 0; i < semanasAnalisis.length; i++) {
      if (semanasAnalisis[i].anio === anio) perfil[semanasAnalisis[i].numeroSemana - 1] = serieGlobalAnalisis[i];
    }
    perfilPorAnio.set(anio, perfil);
  }
  const correlacionesEntreAnios = [];
  for (let i = 0; i < aniosPresentes.length - 1; i++) {
    const a1 = perfilPorAnio.get(aniosPresentes[i]);
    const a2 = perfilPorAnio.get(aniosPresentes[i + 1]);
    const pares = [];
    for (let s = 0; s < 53; s++) if (a1[s] != null && a2[s] != null) pares.push([a1[s], a2[s]]);
    const corr = pares.length > 5 ? correlacion(pares.map((p) => p[0]), pares.map((p) => p[1])) : null;
    correlacionesEntreAnios.push({ anios: `${aniosPresentes[i]} vs ${aniosPresentes[i + 1]}`, nSemanasComunes: pares.length, correlacion: corr });
  }
  console.log('Estabilidad del perfil estacional año a año:');
  console.table(correlacionesEntreAnios.map((c) => ({ ...c, correlacion: c.correlacion?.toFixed(3) })));

  // --- 3. Variación semanal (semana a semana) --------------------------------
  const cambiosPct = [];
  for (let i = 1; i < serieGlobalAnalisis.length; i++) {
    if (serieGlobalAnalisis[i - 1] > 0) cambiosPct.push((serieGlobalAnalisis[i] - serieGlobalAnalisis[i - 1]) / serieGlobalAnalisis[i - 1]);
  }
  const cambiosOrdenados = [...cambiosPct].sort((a, b) => a - b);
  console.log('\n=== 3. VARIACIÓN SEMANA A SEMANA (% cambio) ===');
  console.log(
    `media=${(media(cambiosPct) * 100).toFixed(1)}% desvío=${(desvio(cambiosPct) * 100).toFixed(1)}% ` +
      `p5=${(percentil(cambiosOrdenados, 0.05) * 100).toFixed(1)}% p25=${(percentil(cambiosOrdenados, 0.25) * 100).toFixed(1)}% ` +
      `p50=${(percentil(cambiosOrdenados, 0.5) * 100).toFixed(1)}% p75=${(percentil(cambiosOrdenados, 0.75) * 100).toFixed(1)}% ` +
      `p95=${(percentil(cambiosOrdenados, 0.95) * 100).toFixed(1)}%`,
  );

  // --- 4. Diferencias entre fincas -------------------------------------------
  const totalGlobalAnalisis = serieGlobalAnalisis.reduce((a, b) => a + b, 0);
  const porFinca = fincas
    .map((f) => {
      const serieCompleta = seriesPorFinca.get(f.id);
      const serie = serieCompleta.slice(primerIdxConDato, ultimoIdxConDato + 1);
      const total = serie.reduce((a, b) => a + b, 0);
      if (total === 0) return null;
      const primerIdxFinca = serie.findIndex((v) => v > 0);
      const serieActiva = serie.slice(primerIdxFinca);
      const xs = serieActiva.map((_, i) => i);
      const { b: pendiente, r2 } = regresionLineal(xs, serieActiva);
      const corrConGlobal = correlacion(serie, serieGlobalAnalisis);
      return {
        codigo: f.codigo,
        nombre: f.nombre,
        total,
        pctDelTotal: (total / totalGlobalAnalisis) * 100,
        promedioSemanal: media(serieActiva),
        cv: desvio(serieActiva) != null && media(serieActiva) > 0 ? desvio(serieActiva) / media(serieActiva) : null,
        pendienteSemanal: pendiente,
        r2Tendencia: r2,
        correlacionConGlobal: corrConGlobal,
        semanasActivas: serieActiva.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  console.log('\n=== 4. DIFERENCIAS ENTRE FINCAS ===');
  console.table(
    porFinca.map((f) => ({
      codigo: f.codigo,
      nombre: f.nombre,
      '% del total': f.pctDelTotal.toFixed(1),
      promedioSemanal: f.promedioSemanal.toFixed(0),
      CV: f.cv?.toFixed(2),
      pendiente: f.pendienteSemanal?.toFixed(2),
      corrConGlobal: f.correlacionConGlobal?.toFixed(2),
      semanasActivas: f.semanasActivas,
    })),
  );

  // --- 5. Autocorrelación y 6. Persistencia ----------------------------------
  const acfNivel = acf(serieGlobalAnalisis, 53);
  const acfResiduos = acf(residuosTendencia, 53);
  const lagsDestacados = [1, 2, 3, 4, 8, 12, 26, 52];
  console.log('\n=== 5. AUTOCORRELACIÓN (sobre residuos de tendencia) ===');
  console.table(
    lagsDestacados.map((l) => ({
      lag: l,
      'ACF (nivel)': acfNivel.find((a) => a.lag === l)?.acf?.toFixed(3),
      'ACF (residuos de tendencia)': acfResiduos.find((a) => a.lag === l)?.acf?.toFixed(3),
    })),
  );
  const phi1 = acfResiduos.find((a) => a.lag === 1)?.acf ?? null;
  const vidaMedia = phi1 != null && phi1 > 0 && phi1 < 1 ? Math.log(0.5) / Math.log(phi1) : null;
  console.log(`\n=== 6. PERSISTENCIA ===`);
  console.log(
    `Autocorrelación lag-1 de los residuos (≈ coeficiente AR(1)): φ=${phi1?.toFixed(3)}` +
      (vidaMedia != null ? ` → un "shock" tarda ~${vidaMedia.toFixed(1)} semanas en decaer a la mitad.` : ''),
  );
  // Persistencia también sobre los CAMBIOS (momentum vs reversión a la media)
  const acfCambios = acf(cambiosPct, 8);
  console.log('Autocorrelación de los cambios semana-a-semana (momentum si >0, reversión si <0):');
  console.table(acfCambios.slice(0, 4).map((a) => ({ lag: a.lag, acf: a.acf?.toFixed(3) })));

  // --- 7. Eventos atípicos ---------------------------------------------------
  // IMPORTANTE: se usan los residuos de TENDENCIA + ESTACIONALIDAD
  // (residuosEstacionales), no solo de tendencia — contra una línea base
  // puramente lineal, la temporada alta (Oct-Dic, ver punto 2) aparece como
  // "atípica" todos los años simplemente por ser estacionalmente alta, lo
  // cual no es una anomalía real. Restando también el índice estacional se
  // aísla lo que de verdad se sale del patrón esperado para esa semana del
  // año.
  const madResiduos = mad(residuosEstacionales);
  const medianaResiduos = mediana(residuosEstacionales);
  const UMBRAL_MAD = 4; // ~equivalente a un z-score robusto de ~2.7 con MAD normalizado
  const atipicos = [];
  for (let i = 0; i < semanasAnalisis.length; i++) {
    const zRobusto = madResiduos > 0 ? (residuosEstacionales[i] - medianaResiduos) / (1.4826 * madResiduos) : 0;
    if (Math.abs(zRobusto) > UMBRAL_MAD / 1.4826) {
      atipicos.push({
        semana: semanasAnalisis[i].codigo,
        valor: serieGlobalAnalisis[i],
        residuo: Math.round(residuosEstacionales[i]),
        zRobusto: zRobusto.toFixed(2),
      });
    }
  }
  console.log(`\n=== 7. EVENTOS ATÍPICOS (${atipicos.length} semanas fuera de ~4 MAD de tendencia+estacionalidad) ===`);
  console.table(atipicos);

  // --- Guardar todo para construir el documento ------------------------------
  const salida = {
    generadoEn: new Date().toISOString(),
    rangoAnalisis: { desde: semanasAnalisis[0].codigo, hasta: semanasAnalisis[semanasAnalisis.length - 1].codigo, nSemanas: semanasAnalisis.length },
    tendenciaGlobal,
    tendenciaPorAnio,
    estacionalidad,
    eta2Estacional,
    semanasOrdenadasPorMedia: { altas: semanasOrdenadasPorMedia.slice(0, 5), bajas: semanasOrdenadasPorMedia.slice(-5) },
    correlacionesEntreAnios,
    variacionSemanal: {
      media: media(cambiosPct),
      desvio: desvio(cambiosPct),
      p5: percentil(cambiosOrdenados, 0.05),
      p25: percentil(cambiosOrdenados, 0.25),
      p50: percentil(cambiosOrdenados, 0.5),
      p75: percentil(cambiosOrdenados, 0.75),
      p95: percentil(cambiosOrdenados, 0.95),
    },
    porFinca,
    acfNivel,
    acfResiduos,
    persistencia: { phi1, vidaMediaSemanas: vidaMedia },
    acfCambios,
    atipicos,
    reduccionVarianzaConEstacionalidad: {
      desvioResiduoSoloTendencia: desvio(residuosTendencia),
      desvioResiduoTendenciaMasEstacional: desvio(residuosEstacionales),
    },
  };
  writeFileSync(SALIDA, JSON.stringify(salida, null, 2));
  console.log(`\nGuardado: ${SALIDA}`);
}

main()
  .then(() => (process.exitCode = 0))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
