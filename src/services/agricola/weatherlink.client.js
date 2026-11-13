// Cliente mínimo de la API v2 de WeatherLink — https://weatherlink.github.io/v2-api/. Autenticación: `api-key` como query param, `X-Api-Secret` como
// header (no hace falta firmar con HMAC en v2, eso es del sistema legacy). Las estaciones y sus credenciales se administran desde la web (tabla
// `estaciones_meteorologicas`, ver estacionCredenciales.service.js); las dos primeras conservan las variables de entorno como respaldo.
import { credenciales, estacionValida } from './estacionCredenciales.service.js';

export { estacionValida };

const BASE_URL = 'https://api.weatherlink.com/v2';

async function get(estacion, path, params = {}) {
  const { apiKey, apiSecret } = await credenciales(estacion);
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
  async stationId(estacion = 1) {
    return (await credenciales(estacion)).stationId;
  },

  // Condiciones actuales — todos los sensores de la estación (interior,
  // presión, consola, exterior). El exterior es sensor_type 43.
  async current(estacion = 1) {
    const { stationId } = await credenciales(estacion);
    return get(estacion, `/current/${stationId}`);
  },

  // Registros archivados (cada `recording_interval` minutos) entre dos
  // timestamps Unix — la API limita cada request a un máximo de 24h
  // (86400s), así que quien llama debe trocear rangos más largos.
  async historic(startTimestamp, endTimestamp, estacion = 1) {
    const { stationId } = await credenciales(estacion);
    return get(estacion, `/historic/${stationId}`, { 'start-timestamp': startTimestamp, 'end-timestamp': endTimestamp });
  },
};

export default weatherlinkClient;
