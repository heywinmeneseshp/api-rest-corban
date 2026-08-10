// Utilidades compartidas entre los scripts de backtesting del Pronóstico de
// Cajas (MAPE/Bias y generación de cuantiles de error) — extraídas de
// backtest-pronostico.mjs para no duplicar la lógica de muestreo de fincas,
// verificación anti-fuga-de-futuro, y consulta de datos reales.

import { Op } from 'sequelize';
import { Finca, Semana } from '../../src/database/associations.js';
import { racimoMovimientoRepository } from '../../src/repositories/agricola/racimoMovimiento.repository.js';
import { produccionSemanalRepository } from '../../src/repositories/agricola/produccionSemanal.repository.js';

export const MS_DIA = 86400000;

export function toISO(d) {
  return d.toISOString().slice(0, 10);
}

// La propiedad más importante del backtest: ninguna semana con fecha_inicio
// posterior a asOfDate puede haber influido en el cálculo. Se verifica
// re-consultando fecha_inicio de cada semana referenciada en las filas y
// comparándola contra asOfDate.
export async function verificarSinFuga(rows, asOfDate) {
  if (rows.length === 0) return;
  const uuids = [...new Set(rows.map((r) => r.semanaUuid))];
  const semanas = await Semana.findAll({ where: { uuid: { [Op.in]: uuids } }, attributes: ['uuid', 'fechaInicio'] });
  const fechaPorUuid = new Map(semanas.map((s) => [s.uuid, s.fechaInicio]));
  const asOfISO = toISO(asOfDate);
  for (const r of rows) {
    const fechaInicio = fechaPorUuid.get(r.semanaUuid);
    if (!fechaInicio) continue;
    const esFutura = fechaInicio > asOfISO;
    if (r.real && esFutura) {
      throw new Error(
        `FUGA DE FUTURO: fila marcada real=true para semana ${r.semanaCodigo} (fecha_inicio ${fechaInicio}) ` +
          `es posterior a asOfDate=${asOfISO}`,
      );
    }
    if (!r.real && !esFutura) {
      throw new Error(
        `FUGA DE FUTURO: fila marcada real=false para semana ${r.semanaCodigo} (fecha_inicio ${fechaInicio}) ` +
          `no es posterior a asOfDate=${asOfISO} — debería estar marcada real`,
      );
    }
  }
}

export async function fincasDeMuestra() {
  const todasFincas = await Finca.findAll({ where: { estado: true }, attributes: ['id', 'uuid', 'codigo', 'nombre'] });
  const semanasRecientes = await Semana.findAll({
    order: [['fechaInicio', 'DESC']],
    limit: 52,
    attributes: ['id'],
  });
  const semanaIds = semanasRecientes.map((s) => s.id);
  const fincaIds = todasFincas.map((f) => f.id);
  const embolseMap = await racimoMovimientoRepository.getEmbolsePorFincaYSemana({ fincaIds, semanaEmbolseIds: semanaIds });
  const volumenPorFinca = new Map();
  for (const f of todasFincas) volumenPorFinca.set(f.id, 0);
  for (const [key, total] of embolseMap) {
    const fincaId = Number(key.split('-')[0]);
    volumenPorFinca.set(fincaId, (volumenPorFinca.get(fincaId) || 0) + total);
  }
  const ordenadas = todasFincas
    .map((f) => ({ ...f.toJSON(), volumen: volumenPorFinca.get(f.id) || 0 }))
    .sort((a, b) => a.volumen - b.volumen);

  const chica = ordenadas[Math.floor(ordenadas.length * 0.15)];
  const mediana = ordenadas[Math.floor(ordenadas.length * 0.5)];
  const grande = ordenadas[ordenadas.length - 1];
  const mariaMargarita = ordenadas.find((f) => f.id === 16); // caso de regresión: bug de Grupo de Finca

  const muestra = [chica, mediana, grande, mariaMargarita].filter(Boolean);
  const vistos = new Set();
  return muestra.filter((f) => {
    if (vistos.has(f.id)) return false;
    vistos.add(f.id);
    return true;
  });
}

export function fechasAsOfDate(desdeStr, hastaStr, pasoDias) {
  const fechas = [];
  const desde = new Date(`${desdeStr}T00:00:00Z`);
  const hasta = new Date(`${hastaStr}T00:00:00Z`);
  for (let t = desde.getTime(); t <= hasta.getTime(); t += pasoDias * MS_DIA) {
    fechas.push(new Date(t));
  }
  return fechas;
}

export async function actualPara(fincaIds, semanaId) {
  const [cosechadoMap, cajasMap] = await Promise.all([
    racimoMovimientoRepository.getCosechadoPorFincaYSemana({ fincaIds, semanaRegistroIds: [semanaId] }),
    produccionSemanalRepository.getCajasPorFincaYSemana({ fincaIds, semanaIds: [semanaId] }),
  ]);
  let racimos = 0;
  let cajas = 0;
  for (const fid of fincaIds) {
    racimos += cosechadoMap.get(`${fid}-${semanaId}`) || 0;
    cajas += cajasMap.get(`${fid}-${semanaId}`) || 0;
  }
  return { racimos, cajas };
}

// Embolse real ya registrado para una semana específica — ground truth para
// la etapa 1 (racimos embolsados) del backtest por etapas. Separado de
// actualPara() porque mide una cosa distinta: cuánto se embolsó ESA semana,
// no cuánto se cosechó/facturó como resultado de embolses anteriores.
export async function embolseActualPara(fincaIds, semanaId) {
  const embolseMap = await racimoMovimientoRepository.getEmbolsePorFincaYSemana({
    fincaIds,
    semanaEmbolseIds: [semanaId],
  });
  let embolse = 0;
  for (const fid of fincaIds) embolse += embolseMap.get(`${fid}-${semanaId}`) || 0;
  return embolse;
}
