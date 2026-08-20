import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';

// Para endpoints de integración servidor-a-servidor llamados por
// api-rest-banarica (ej. avisar que ya cargó la Programación de Corte de
// una semana) — exige el header `api` con CORBANA_API_KEY, en espejo del
// mismo esquema que Corbana usa para llamar a Banarica (ver
// checkApiKeyOrJwt en api-rest-banarica/middlewares/auth.handler.js).
export const requireApiKey = (req, _res, next) => {
  const apiKey = req.header('api');
  if (!env.integrations.corbanaApiKey || apiKey !== env.integrations.corbanaApiKey) {
    return next(ApiError.unauthorized('API key inválida o no configurada'));
  }
  next();
};

export default requireApiKey;
