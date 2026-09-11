import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config.js';
import { verifyAccessToken } from '../utils/jwt.js';

// Identifica al usuario autenticado (si el access token es válido) en vez
// de solo la IP — varias personas de la misma finca/oficina suelen salir a
// internet por la MISMA IP pública (NAT), así que limitar por IP las junta
// a todas en un único cupo: un día con varios usuarios activos a la vez
// dispara "Demasiadas solicitudes" para todo el mundo aunque cada uno,
// individualmente, esté muy por debajo de un uso razonable. Verificar el
// JWT acá es barato (HMAC sincrónico) y no reemplaza la autenticación real
// de cada ruta — si es inválido/expiró, cae a la IP, igual que antes.
function claveDeSolicitud(req) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      if (payload?.id) return `user:${payload.id}`;
    } catch {
      // token inválido o expirado: se trata como si no hubiera token
    }
  }
  return req.ip;
}

export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveDeSolicitud,
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
