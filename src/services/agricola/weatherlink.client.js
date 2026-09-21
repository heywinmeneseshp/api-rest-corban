// Cliente mínimo de la API v2 de WeatherLink (estación meteorológica
// Pantoja 01 Norte) — https://weatherlink.github.io/v2-api/. Autenticación:
// `api-key` como query param, `X-Api-Secret` como header (no hace falta
// firmar con HMAC en v2, eso es del sistema legacy).
const BASE_URL = 'https://api.weatherlink.com/v2';

function credenciales() {
  const apiKey = process.env.WEATHERLINK_API_KEY;
  const apiSecret = process.env.WEATHERLINK_API_SECRET;
  const stationId = process.env.WEATHERLINK_STATION_ID;
  if (!apiKey || !apiSecret || !stationId) {
    throw new Error('Faltan WEATHERLINK_API_KEY / WEATHERLINK_API_SECRET / WEATHERLINK_STATION_ID en las variables de entorno');
  }
  return { apiKey, apiSecret, stationId };
}

async function get(path, params = {}) {
  const { apiKey, apiSecret } = credenciales();
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
  stationId() {
    return credenciales().stationId;
  },

  // Condiciones actuales — todos los sensores de la estación (interior,
  // presión, consola, exterior). El exterior es sensor_type 43.
  async current() {
    const { stationId } = credenciales();
    return get(`/current/${stationId}`);
  },

  // Registros archivados (cada `recording_interval` minutos) entre dos
  // timestamps Unix — la API limita cada request a un máximo de 24h
  // (86400s), así que quien llama debe trocear rangos más largos.
  async historic(startTimestamp, endTimestamp) {
    const { stationId } = credenciales();
    return get(`/historic/${stationId}`, { 'start-timestamp': startTimestamp, 'end-timestamp': endTimestamp });
  },
};

export default weatherlinkClient;
