// Pronóstico del clima en la ubicación de una estación meteorológica. Las estaciones (WeatherLink) solo miden: no traen
// pronóstico. Se pide a Open-Meteo (API pública, la misma que usa el clima de las fincas) con las coordenadas que la
// estación tiene registradas en WeatherLink. Se guarda en memoria 30 minutos por estación para no consultar a cada rato.
import { weatherlinkClient } from './weatherlink.client.js';
import { estacionValida } from './estacionCredenciales.service.js';
import { ApiError } from '../../utils/ApiError.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map(); // estacion -> { en, data }
const coordenadas = new Map(); // estacion -> { lat, lng, nombre }

const r1 = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
const entero = (v) => (v === null || v === undefined ? null : Math.round(Number(v)));

// Código WMO de Open-Meteo -> descripción corta y tipo de ícono para la app.
function descripcionWmo(codigo) {
  const c = Number(codigo);
  if (c === 0) return { texto: 'Despejado', icono: 'sol' };
  if (c <= 2) return { texto: 'Parcialmente nublado', icono: 'sol-nubes' };
  if (c === 3) return { texto: 'Nublado', icono: 'nubes' };
  if (c === 45 || c === 48) return { texto: 'Niebla', icono: 'niebla' };
  if (c >= 51 && c <= 57) return { texto: 'Llovizna', icono: 'llovizna' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { texto: c >= 65 || c === 82 ? 'Lluvia fuerte' : 'Lluvia', icono: 'lluvia' };
  if (c >= 95) return { texto: 'Tormenta', icono: 'tormenta' };
  return { texto: 'Variable', icono: 'nubes' };
}

async function coordenadasDe(estacion) {
  if (coordenadas.has(estacion)) return coordenadas.get(estacion);
  const info = await weatherlinkClient.estacionInfo(estacion);
  const lat = Number(info?.latitude);
  const lng = Number(info?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw ApiError.badRequest('La estación no tiene coordenadas registradas en WeatherLink');
  const c = { lat, lng, nombre: info?.station_name || null };
  coordenadas.set(estacion, c);
  return c;
}

export const pronosticoEstacionService = {
  async obtener(estacionParam = 1) {
    const estacion = await estacionValida(estacionParam);
    const guardado = cache.get(estacion);
    if (guardado && Date.now() - guardado.en < CACHE_MS) return guardado.data;

    const { lat, lng, nombre } = await coordenadasDe(estacion);
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code');
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean',
    );
    url.searchParams.set('forecast_days', '7');
    url.searchParams.set('timezone', 'America/Bogota');
    url.searchParams.set('wind_speed_unit', 'kmh');
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw ApiError.badRequest('No se pudo obtener el pronóstico (Open-Meteo no respondió)');
    const d = await res.json();

    // Próximas 24 h, cada 3 horas, desde la hora actual de Bogotá. La lluvia es la suma de las 3 horas del bloque.
    const h = d.hourly || {};
    const ahora = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 13); // "YYYY-MM-DDTHH" en hora Bogotá
    const inicio = Math.max(0, (h.time || []).findIndex((t) => t.slice(0, 13) >= ahora));
    const horas = [];
    for (let i = inicio; i < Math.min((h.time || []).length, inicio + 24); i += 3) {
      const bloque = [i, i + 1, i + 2].filter((k) => k < h.time.length);
      horas.push({
        hora: h.time[i],
        temperatura: r1(h.temperature_2m?.[i]),
        humedad: entero(h.relative_humidity_2m?.[i]),
        probabilidadLluvia: entero(Math.max(...bloque.map((k) => h.precipitation_probability?.[k] ?? 0))),
        lluviaMm: r1(bloque.reduce((a, k) => a + (h.precipitation?.[k] ?? 0), 0)),
        ...descripcionWmo(h.weather_code?.[i]),
      });
    }

    const dd = d.daily || {};
    const dias = (dd.time || []).map((fecha, i) => ({
      fecha,
      temperaturaMax: r1(dd.temperature_2m_max?.[i]),
      temperaturaMin: r1(dd.temperature_2m_min?.[i]),
      humedad: entero(dd.relative_humidity_2m_mean?.[i]),
      lluviaMm: r1(dd.precipitation_sum?.[i]),
      probabilidadLluvia: entero(dd.precipitation_probability_max?.[i]),
      vientoMaxKmh: r1(dd.wind_speed_10m_max?.[i]),
      ...descripcionWmo(dd.weather_code?.[i]),
    }));

    const data = { estacion, nombre, latitud: lat, longitud: lng, fuente: 'Open-Meteo', generadoEn: new Date().toISOString(), horas, dias };
    cache.set(estacion, { en: Date.now(), data });
    return data;
  },
};

export default pronosticoEstacionService;
