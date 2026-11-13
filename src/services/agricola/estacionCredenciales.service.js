import { EstacionMeteorologica } from '../../database/associations.js';
import { descifrar } from '../../utils/secretos.js';
import { ApiError } from '../../utils/ApiError.js';

// Acceso a las estaciones meteorológicas registradas en la base y a sus credenciales de WeatherLink (cifradas). Es lo que usa el cliente de WeatherLink
// (weatherlink.client.js) y el servicio de la estación. Para las estaciones 1 y 2 (las de siempre), si en la base no hay credenciales completas se
// siguen leyendo las variables de entorno WEATHERLINK_*[_2], así nada se rompe mientras se pasan a la pantalla de administración.
const TTL_MS = 60 * 1000;
let cache = null; // { t, mapa: Map(id -> fila) }

export const sufijoEntorno = (id) => (id === 1 ? '' : id === 2 ? '_2' : null);

function desdeEntorno(id) {
  const sufijo = sufijoEntorno(id);
  if (sufijo === null) return null;
  const apiKey = process.env[`WEATHERLINK_API_KEY${sufijo}`];
  const apiSecret = process.env[`WEATHERLINK_API_SECRET${sufijo}`];
  const stationId = process.env[`WEATHERLINK_STATION_ID${sufijo}`];
  return apiKey && apiSecret && stationId ? { apiKey, apiSecret, stationId } : null;
}

async function cargar() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.mapa;
  const filas = await EstacionMeteorologica.findAll({ attributes: ['id', 'nombre', 'estado', 'apiKey', 'apiSecret', 'stationId'], raw: true });
  const mapa = new Map(filas.map((f) => [Number(f.id), f]));
  cache = { t: Date.now(), mapa };
  return mapa;
}

// Debe llamarse al crear, editar o borrar una estación.
export const limpiarCacheEstaciones = () => {
  cache = null;
};

export async function estacionesActivas() {
  const mapa = await cargar();
  return [...mapa.values()].filter((e) => e.estado).sort((a, b) => a.id - b.id).map((e) => ({ id: Number(e.id), nombre: e.nombre }));
}

export async function nombreEstacion(id) {
  return (await cargar()).get(Number(id))?.nombre ?? `Estación ${id}`;
}

// Número de estación válido (existe y no está borrada); lanza error si no.
export async function estacionValida(estacion) {
  const n = Number(estacion ?? 1);
  if (!Number.isInteger(n) || !(await cargar()).has(n)) throw new Error(`Estación desconocida: ${estacion}`);
  return n;
}

// Credenciales de WeatherLink de una estación: las de la base (descifradas) o, para 1 y 2, las del entorno.
export async function credenciales(estacion) {
  const id = await estacionValida(estacion);
  const fila = (await cargar()).get(id);
  const apiKey = descifrar(fila.apiKey);
  const apiSecret = descifrar(fila.apiSecret);
  if (apiKey && apiSecret && fila.stationId) return { apiKey, apiSecret, stationId: fila.stationId, origen: 'base' };
  const entorno = desdeEntorno(id);
  if (entorno) return { ...entorno, origen: 'entorno' };
  throw ApiError.badRequest(`La estación «${fila.nombre}» no tiene las credenciales completas (API key, API secret y Station ID). Complétalas en la tuerca (⚙) de esta pantalla.`);
}

// ¿De dónde salen las credenciales de una estación? 'base' | 'entorno' | null (incompletas).
export function origenCredenciales(fila) {
  if (descifrar(fila.apiKey) && descifrar(fila.apiSecret) && fila.stationId) return 'base';
  return desdeEntorno(Number(fila.id)) ? 'entorno' : null;
}
