import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config.js';

export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
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
