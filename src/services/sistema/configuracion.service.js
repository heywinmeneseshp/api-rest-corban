import { configuracionRepository } from '../../repositories/sistema/configuracion.repository.js';
import { env } from '../../config/env.config.js';

export const CLAVE_BANARICA_API_URL = 'banarica_api_url';

export const configuracionService = {
  async getBanaricaApiUrl() {
    const config = await configuracionRepository.findByClave(CLAVE_BANARICA_API_URL);
    return config?.valor || env.integrations.banaricaBaseUrl;
  },

  async setBanaricaApiUrl(url, actorId) {
    const config = await configuracionRepository.upsert(CLAVE_BANARICA_API_URL, url, actorId);
    return { clave: CLAVE_BANARICA_API_URL, valor: config.valor };
  },
};

export default configuracionService;
