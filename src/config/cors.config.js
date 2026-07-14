import { env } from './env.config.js';

const allowedOrigins = env.cors.origin === '*' ? '*' : env.cors.origin.split(',').map((o) => o.trim());

export const corsConfig = {
  origin: (origin, callback) => {
    if (allowedOrigins === '*' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
