// Cliente mínimo de la API v2 de WeatherLink (estaciones
// Pantoja 01 Norte y San Francisco Consola) — https://weatherlink.github.io/v2-api/. Autenticación:
// `api-key` como query param, `X-Api-Secret` como header (no hace falta
// firmar con HMAC en v2, eso es del sistema legacy).
const BASE_URL = 'https://api.weatherlink.com/v2';

// Estaciones configuradas: 1 usa WEATHERLINK_*, 2 usa WEATHERLINK_*_2.
export const ESTACIONES = {
  1: { nombre: 'Pantoja 01 Norte', sufijo: '' },
  2: { nombre: 'San Francisco Consola', sufijo: '_2' },
};

export function estacionValida(estacion) {
  const n = Number(estacion ?? 1);
  if (!ESTACIONES[n]) throw new Error(`Estación desconocida: ${estacion}`);
  return n;
}

function credenciales(estacion) {
  const { sufijo } = ESTACIONES[estacionValida(estacion)];
  const apiKey = process.env[`WEATHERLINK_API_KEY${sufijo}`];
  const apiSecret = process.env[`WEATHERLINK_API_SECRET${sufijo}`];
  const stationId = process.env[`WEATHERLINK_STATION_ID${sufijo}`];
  if (!apiKey || !apiSecret || !stationId) {
    throw new Error(`Faltan WEATHERLINK_API_KEY${sufijo} / WEATHERLINK_API_SECRET${sufijo} / WEATHERLINK_STATION_ID${sufijo} en las variables de entorno`);
  }
  return { apiKey, apiSecret, stationId };
}

async function get(estacion, path, params = {}) {
  const { apiKey, apiSecret } = credenciales(estacion);
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api-key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers: { 'X-Api-Secret': apiSecret } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`WeatherLink API (${path}): ${data?.message || res.statusText}`);
  }
  return data;
}

export const weatherlinkClient = {
  stationId(estacion = 1) {
    return credenciales(estacion).stationId;
  },

  // Condiciones actuales — todos los sensores de la estación (interior,
  // presión, consola, exterior). El exterior es sensor_type 43.
  async current(estacion = 1) {
    const { stationId } = credenciales(estacion);
    return get(estacion, `/current/${stationId}`);
  },

  // Registros archivados (cada `recording_interval` minutos) entre dos
  // timestamps Unix — la API limita cada request a un máximo de 24h
  // (86400s), así que quien llama debe trocear rangos más largos.
  async historic(startTimestamp, endTimestamp, estacion = 1) {
    const { stationId } = credenciales(estacion);
    return get(estacion, `/historic/${stationId}`, { 'start-timestamp': startTimestamp, 'end-timestamp': endTimestamp });
  },
};

export default weatherlinkClient;
