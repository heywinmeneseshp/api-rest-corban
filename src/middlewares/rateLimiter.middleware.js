import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config.js';

export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // El polling de progreso del cargue masivo (cada 1.5s durante todo el
  // proceso) es una lectura liviana en memoria, no una carga real al
  // servidor/BD — no debería consumir el mismo cupo que el resto de la API,
  // o los cargues grandes (varias partes en secuencia) disparan este límite
  // solos, sin que el usuario esté haciendo nada más.
  skip: (req) => /\/bulk-progress\//.test(req.path),
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intente nuevamente más tarde',
    errors: [],
  },
});

export const authRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación, intente nuevamente más tarde',
    errors: [],
  },
});

export default globalRateLimiter;
