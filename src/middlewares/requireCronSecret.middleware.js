import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';

// Solo Vercel Cron Jobs debe poder llamar estos endpoints — Vercel manda
// automáticamente `Authorization: Bearer <CRON_SECRET>` en cada invocación
// programada cuando esa env var está configurada en el proyecto.
export const requireCronSecret = (req, res, next) => {
  const auth = req.header('Authorization') || '';
  const esperado = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || auth !== esperado) {
    return next(ApiError.unauthorized('No autorizado'));
  }
  next();
};

export default requireCronSecret;
