import { Op } from 'sequelize';
import { EstacionClimaDiaria } from '../../database/associations.js';
import { weatherlinkClient } from './weatherlink.client.js';
import { ApiError } from '../../utils/ApiError.js';
import { configuracionService } from '../sistema/configuracion.service.js';
import { mailService } from '../sistema/mail.service.js';
import { resolverDestinatarios } from '../../utils/resolverDestinatarios.js';
import { logger } from '../../utils/logger.js';

const HORAS_LIMITE_SIN_DATOS = 24;
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

// Todas las fechas entre desde/hasta (inclusive), como AAAA-MM-DD — mismo
// patron que rangoFechas() en precipitacionDiaria.service.js.
function rangoFechas(desdeIso, hastaIso) {
  const fechas = [];
  const cursor = new Date(`${desdeIso}T00:00:00Z`);
  const fin = new Date(`${hastaIso}T00:00:00Z`);
  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
}

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Pausa entre llamadas sucesivas a WeatherLink al sincronizar varios dias
// seguidos (rango manual o relleno de faltantes) — la API no documenta un
// limite de requests/minuto, pero nada protege contra un burst si no se
// espacian, asi que se espacian igual por las dudas.
const PAUSA_ENTRE_DIAS_MS = 400;

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
  // completo y lo resume: mm = suma de lluvia del día; temperatura/humedad/
  // viento = promedio de los registros del día; temperatura y viento
  // máximos/mínimos = el mayor/menor hi/lo reportado en cualquier registro
  // del día (cada registro ya trae su propio hi/lo del intervalo). Guarda
  // (o actualiza) la fila de `estacion_clima_diaria` para esa fecha.
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
    let tempMax = null;
    let tempMin = null;
    let sumaViento = 0;
    let countViento = 0;
    let vientoMax = null;
    for (const r of registros) {
      if (r.rainfall_mm !== null && r.rainfall_mm !== undefined) sumaMm += Number(r.rainfall_mm);
      if (r.temp_avg !== null && r.temp_avg !== undefined) {
        sumaTemp += aCelsius(r.temp_avg);
        countTemp += 1;
      }
      if (r.temp_hi !== null && r.temp_hi !== undefined) {
        const c = aCelsius(r.temp_hi);
        if (tempMax === null || c > tempMax) tempMax = c;
      }
      if (r.temp_lo !== null && r.temp_lo !== undefined) {
        const c = aCelsius(r.temp_lo);
        if (tempMin === null || c < tempMin) tempMin = c;
      }
      if (r.hum_hi !== null && r.hum_hi !== undefined && r.hum_lo !== null && r.hum_lo !== undefined) {
        sumaHum += (Number(r.hum_hi) + Number(r.hum_lo)) / 2;
        countHum += 1;
      }
      if (r.wind_speed_avg !== null && r.wind_speed_avg !== undefined) {
        sumaViento += Number(r.wind_speed_avg) * 1.60934;
        countViento += 1;
      }
      if (r.wind_speed_hi !== null && r.wind_speed_hi !== undefined) {
        const kmh = Number(r.wind_speed_hi) * 1.60934;
        if (vientoMax === null || kmh > vientoMax) vientoMax = kmh;
      }
    }

    const valores = {
      mm: registros.length ? round2(sumaMm) : null,
      temperatura: countTemp > 0 ? round2(sumaTemp / countTemp) : null,
      temperaturaMaxima: round2(tempMax),
      temperaturaMinima: round2(tempMin),
      humedadRelativa: countHum > 0 ? round2(sumaHum / countHum) : null,
      vientoVelocidad: countViento > 0 ? round2(sumaViento / countViento) : null,
      vientoMax: round2(vientoMax),
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

  // Sincroniza cada día entre fechaDesde y fechaHasta (inclusive), uno por
  // uno (la API de WeatherLink no admite pedir varios días en un solo
  // request — ver rangoDiaBogota). No corta el rango si un día falla —
  // sigue con los demás y reporta cuáles fallaron.
  async sincronizarRango(fechaDesde, fechaHasta) {
    const dias = rangoFechas(fechaDesde, fechaHasta);
    const sincronizados = [];
    const errores = [];
    for (const fecha of dias) {
      try {
        await this.sincronizarFecha(fecha);
        sincronizados.push(fecha);
      } catch (error) {
        errores.push({ fecha, error: error.message });
      }
      if (fecha !== dias[dias.length - 1]) await dormir(PAUSA_ENTRE_DIAS_MS);
    }
    return { sincronizados, errores };
  },

  // Días del último mes (desde hoy-1mes hasta ayer, sin incluir hoy —
  // todavía no cierra) que NO tienen fila en estacion_clima_diaria.
  async diasFaltantesUltimoMes() {
    const ayer = fechaAyerBogota();
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = new Date(`${hoy}T00:00:00Z`);
    desde.setUTCMonth(desde.getUTCMonth() - 1);
    const fechaDesde = desde.toISOString().slice(0, 10);

    const registrados = await EstacionClimaDiaria.findAll({
      where: { fecha: { [Op.between]: [fechaDesde, ayer] } },
      attributes: ['fecha'],
    });
    const registradosSet = new Set(registrados.map((r) => (r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha))));

    return rangoFechas(fechaDesde, ayer).filter((f) => !registradosSet.has(f));
  },

  // Rellena, uno por uno y espaciados, los días del último mes que todavía
  // no tienen dato — pensado para llamarse al abrir el módulo (ver
  // estacionMeteorologica.controller.js#sincronizarFaltantes), no por cron.
  async sincronizarFaltantes() {
    const faltantes = await this.diasFaltantesUltimoMes();
    if (!faltantes.length) return { sincronizados: [], errores: [] };

    const sincronizados = [];
    const errores = [];
    for (const fecha of faltantes) {
      try {
        await this.sincronizarFecha(fecha);
        sincronizados.push(fecha);
      } catch (error) {
        errores.push({ fecha, error: error.message });
      }
      if (fecha !== faltantes[faltantes.length - 1]) await dormir(PAUSA_ENTRE_DIAS_MS);
    }
    return { sincronizados, errores };
  },

  // ¿La estación lleva más de 24 horas sin reportar? Mira la hora del último
  // dato del sensor exterior en WeatherLink; si la API no devuelve datos o
  // falla la consulta, también cuenta como "sin datos" (con el motivo en
  // `detalle`).
  async verificarSinDatos() {
    let ultimoDato = null;
    let detalle = null;
    try {
      const data = await weatherlinkClient.current();
      const sensor = data.sensors?.find((s) => s.sensor_type === SENSOR_EXTERIOR);
      const ts = sensor?.data?.[0]?.ts;
      if (ts) ultimoDato = new Date(ts * 1000);
      else detalle = 'La estación no reportó datos actuales';
    } catch (err) {
      detalle = err.message;
    }

    const horasSinDatos = ultimoDato ? (Date.now() - ultimoDato.getTime()) / 3600000 : null;
    const sinDatos = ultimoDato === null || horasSinDatos > HORAS_LIMITE_SIN_DATOS;
    return {
      sinDatos,
      ultimoDato: ultimoDato ? ultimoDato.toISOString() : null,
      horasSinDatos: horasSinDatos !== null ? Math.round(horasSinDatos * 10) / 10 : null,
      detalle,
      limiteHoras: HORAS_LIMITE_SIN_DATOS,
    };
  },

  // Revisión diaria (6 a.m.): si la estación lleva más de 24 horas sin datos,
  // manda el correo de alerta a los destinatarios configurados. No manda nada
  // si todo está bien o si no hay destinatarios.
  async enviarAlertaSinDatos() {
    const estado = await this.verificarSinDatos();
    if (!estado.sinDatos) return { ...estado, enviado: false, destinatarios: [] };

    const config = await configuracionService.getEstacionAlertaDestinatarios();
    const personas = await resolverDestinatarios(config);
    const destinatarios = personas.map((p) => p.email).filter(Boolean);
    if (destinatarios.length === 0) {
      logger.warn('Estación meteorológica sin datos, pero no hay destinatarios configurados para la alerta');
      return { ...estado, enviado: false, destinatarios: [] };
    }

    const ultimoDatoTexto = estado.ultimoDato
      ? new Date(estado.ultimoDato).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short' })
      : null;
    await mailService.sendAlertaEstacionSinDatos({
      destinatarios,
      ultimoDatoTexto,
      horasSinDatos: estado.horasSinDatos,
      detalle: estado.detalle,
    });
    return { ...estado, enviado: true, destinatarios };
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
