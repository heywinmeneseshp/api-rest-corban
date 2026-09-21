import { Op } from 'sequelize';
import { EstacionClimaDiaria } from '../../database/associations.js';
import { weatherlinkClient } from './weatherlink.client.js';
import { ApiError } from '../../utils/ApiError.js';

const SENSOR_EXTERIOR = 43; // sensor_type del sensor exterior (lluvia/temp/hum/viento)

const aCelsius = (f) => (f === null || f === undefined ? null : ((Number(f) - 32) * 5) / 9);
const round2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

// Fecha de "ayer" en America/Bogota, como AAAA-MM-DD — el cron corre una
// vez al día y siempre sincroniza el día que recién cerró.
function fechaAyerBogota() {
  const ahora = new Date();
  const bogota = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  bogota.setDate(bogota.getDate() - 1);
  return bogota.toISOString().slice(0, 10);
}

// Rango [00:00, 24:00) de una fecha AAAA-MM-DD en America/Bogota, como
// timestamps Unix — la API limita cada request a 24h (86400s) exactas
// como máximo, así que se resta 1s al final para no pasarse.
function rangoDiaBogota(fechaIso) {
  const inicio = new Date(`${fechaIso}T00:00:00-05:00`);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return { start: Math.floor(inicio.getTime() / 1000), end: Math.floor(fin.getTime() / 1000) };
}

export const estacionMeteorologicaService = {
  // Condiciones actuales — mapea el sensor exterior a campos simples, en
  // unidades métricas (la API ya entrega lluvia en mm; temperatura llega
  // en °F y se convierte).
  async obtenerActual() {
    const data = await weatherlinkClient.current();
    const sensor = data.sensors?.find((s) => s.sensor_type === SENSOR_EXTERIOR);
    const d = sensor?.data?.[0];
    if (!d) throw ApiError.badRequest('La estación no reportó datos actuales');

    return {
      medidoEn: d.ts ? new Date(d.ts * 1000).toISOString() : null,
      temperatura: round2(aCelsius(d.temp)),
      humedadRelativa: round2(d.hum),
      lluviaHoyMm: round2(d.rainfall_day_mm),
      lluviaMesMm: round2(d.rainfall_month_mm),
      lluviaAnioMm: round2(d.rainfall_year_mm),
      lluviaUltimaHoraMm: round2(d.rainfall_last_60_min_mm),
      vientoVelocidadKmh: d.wind_speed_last !== null && d.wind_speed_last !== undefined ? round2(Number(d.wind_speed_last) * 1.60934) : null,
      vientoDireccionGrados: d.wind_dir_last ?? null,
    };
  },

  // Trae el archivo (registros cada `recording_interval` min) de UN día
  // completo y lo resume: mm = suma de lluvia del día; temperatura/humedad
  // = promedio de los registros del día. Guarda (o actualiza) la fila de
  // `estacion_clima_diaria` para esa fecha.
  async sincronizarFecha(fechaIso) {
    const { start, end } = rangoDiaBogota(fechaIso);
    const data = await weatherlinkClient.historic(start, end);
    const sensor = data.sensors?.find((s) => s.sensor_type === SENSOR_EXTERIOR);
    const registros = sensor?.data || [];

    let sumaMm = 0;
    let sumaTemp = 0;
    let countTemp = 0;
    let sumaHum = 0;
    let countHum = 0;
    for (const r of registros) {
      if (r.rainfall_mm !== null && r.rainfall_mm !== undefined) sumaMm += Number(r.rainfall_mm);
      if (r.temp_avg !== null && r.temp_avg !== undefined) {
        sumaTemp += aCelsius(r.temp_avg);
        countTemp += 1;
      }
      if (r.hum_hi !== null && r.hum_hi !== undefined && r.hum_lo !== null && r.hum_lo !== undefined) {
        sumaHum += (Number(r.hum_hi) + Number(r.hum_lo)) / 2;
        countHum += 1;
      }
    }

    const valores = {
      mm: registros.length ? round2(sumaMm) : null,
      temperatura: countTemp > 0 ? round2(sumaTemp / countTemp) : null,
      humedadRelativa: countHum > 0 ? round2(sumaHum / countHum) : null,
    };

    const existente = await EstacionClimaDiaria.findOne({ where: { fecha: fechaIso } });
    if (existente) {
      await existente.update(valores);
      return existente;
    }
    return EstacionClimaDiaria.create({ fecha: fechaIso, ...valores });
  },

  // Llamado por el cron diario (ver cron.controller.js) — sincroniza el
  // día que recién cerró.
  async sincronizarDiaAnterior() {
    const fecha = fechaAyerBogota();
    const fila = await this.sincronizarFecha(fecha);
    return { fecha, registrado: Boolean(fila) };
  },

  async listarHistorico({ fechaDesde, fechaHasta } = {}) {
    const where = {};
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha[Op.gte] = fechaDesde;
      if (fechaHasta) where.fecha[Op.lte] = fechaHasta;
    }
    const items = await EstacionClimaDiaria.findAll({ where, order: [['fecha', 'ASC']] });
    return items;
  },
};

export default estacionMeteorologicaService;
