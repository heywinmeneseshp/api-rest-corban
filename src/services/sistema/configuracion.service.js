import { configuracionRepository } from '../../repositories/sistema/configuracion.repository.js';
import { env } from '../../config/env.config.js';

export const CLAVE_BANARICA_API_URL = 'banarica_api_url';
export const CLAVE_BANARICA_API_KEY = 'banarica_api_key';
export const CLAVE_APP_VERSION_INFO = 'app_version_info';
export const CLAVE_TASA_CONVERSION = 'tasa_conversion';
export const CLAVE_PRIMERA_SEMANA_PROGRAMACION = 'primera_semana_programacion_id';

// "Cajas de 20kg" es el nombre convencional de la unidad, pero el peso neto
// real de referencia es otro (ej. 18.16) — configurable en vez de fijo por
// si en el futuro cambia el estándar. Usado para convertir las cajas de
// Programación de Corte (que vienen en cajas del producto real, con su
// propio peso neto) a esta unidad histórica de Producción Semanal.
const TASA_CONVERSION_DEFAULT = 18.16;

// Valor por defecto si nunca se configuró nada — evita que la app móvil
// reciba un 404/error al arrancar en un ambiente recién desplegado.
const APP_VERSION_DEFAULT = {
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  downloadUrl: '',
  releaseNotes: '',
};

export const configuracionService = {
  async getBanaricaApiUrl() {
    const config = await configuracionRepository.findByClave(CLAVE_BANARICA_API_URL);
    return config?.valor || env.integrations.banaricaBaseUrl;
  },

  async setBanaricaApiUrl(url, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_BANARICA_API_URL, url, actorId);
    return { clave: CLAVE_BANARICA_API_URL, valor: config.valor };
  },

  // API key del header `api` que exige api-rest-banarica en
  // /almacenes/ y /programacion-corte para integraciones servidor-a-servidor
  // (ver checkApiKeyOrJwt allá) — se guarda en texto plano en
  // `configuraciones`, igual que el enlace del API. Nunca se devuelve
  // completa al frontend (solo si hay una guardada), solo se usa server-side.
  async getBanaricaApiKey() {
    const config = await configuracionRepository.findByClave(CLAVE_BANARICA_API_KEY);
    return config?.valor || env.integrations.banaricaApiKey;
  },

  async setBanaricaApiKey(apiKey, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_BANARICA_API_KEY, apiKey, actorId);
    return config.valor;
  },

  async getTasaConversion() {
    const config = await configuracionRepository.findByClave(CLAVE_TASA_CONVERSION);
    const valor = config?.valor ? Number(config.valor) : NaN;
    return Number.isFinite(valor) && valor > 0 ? valor : TASA_CONVERSION_DEFAULT;
  },

  async setTasaConversion(peso, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_TASA_CONVERSION, String(peso), actorId);
    return Number(config.valor);
  },

  // Id de la primera semana (cronológicamente) a la que se le cargó
  // Programación de Corte alguna vez — usada para decidir si un aviso de
  // Rechazos de Logística de una semana previa a esa debe ignorarse (ver
  // rechazoCorteService.syncSemanaWebhook): esas semanas quedaron fuera del
  // seguimiento de Corbana desde antes de que este existiera.
  async getPrimeraSemanaProgramacionId() {
    const config = await configuracionRepository.findByClave(CLAVE_PRIMERA_SEMANA_PROGRAMACION);
    const valor = config?.valor ? Number(config.valor) : NaN;
    return Number.isInteger(valor) ? valor : null;
  },

  async setPrimeraSemanaProgramacionId(semanaId, actorId) {
    await configuracionRepository.upsert(CLAVE_PRIMERA_SEMANA_PROGRAMACION, String(semanaId), actorId);
  },

  async getAppVersionInfo() {
    const config = await configuracionRepository.findByClave(CLAVE_APP_VERSION_INFO);
    if (!config?.valor) return APP_VERSION_DEFAULT;
    try {
      return { ...APP_VERSION_DEFAULT, ...JSON.parse(config.valor) };
    } catch {
      return APP_VERSION_DEFAULT;
    }
  },

  async setAppVersionInfo(info, actorId) {
    const valor = JSON.stringify({
      latestVersion: info.latestVersion,
      minSupportedVersion: info.minSupportedVersion,
      downloadUrl: info.downloadUrl || '',
      releaseNotes: info.releaseNotes || '',
    });
    const config = await configuracionRepository.upsert(CLAVE_APP_VERSION_INFO, valor, actorId);
    return JSON.parse(config.valor);
  },
};

export default configuracionService;
