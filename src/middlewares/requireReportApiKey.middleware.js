import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';

// Para endpoints de reporte de solo lectura pensados para herramientas que
// no manejan login/JWT (ej. Excel Power Query refrescando una URL) — exige
// `apiKey` en la QUERY STRING (no un header, que esas herramientas no
// siempre pueden agregar fácil) contra REPORTES_API_KEY. Nunca deja pasar
// si la clave no está configurada, aunque venga vacía de los dos lados.
export const requireReportApiKey = (req, _res, next) => {
  const apiKey = req.query?.apiKey;
  if (!env.integrations.reportesApiKey || apiKey !== env.integrations.reportesApiKey) {
    return next(ApiError.unauthorized('apiKey inválida o no configurada'));
  }
  next();
};

export default requireReportApiKey;
