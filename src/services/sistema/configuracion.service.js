import { configuracionRepository } from '../../repositories/sistema/configuracion.repository.js';
import { env } from '../../config/env.config.js';

export const CLAVE_BANARICA_API_URL = 'banarica_api_url';
export const CLAVE_APP_VERSION_INFO = 'app_version_info';

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
