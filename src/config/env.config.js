import 'dotenv/config';

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  db: {
    // 'direct'  -> conexión MySQL normal (mysql2), para desarrollo local o un
    //              hosting/VPS que sí permite conexiones externas al puerto 3306.
    // 'bridge'  -> túnel HTTP hacia un script PHP (tunnel.php) desplegado en
    //              el mismo hosting compartido que la base de datos, para
    //              hostings que solo aceptan conexiones MySQL desde localhost.
    //              Ver hosting-tunnel/README.md.
    mode: process.env.DB_MODE === 'bridge' ? 'bridge' : 'direct',
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3306),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
    bridgeUrl: process.env.BRIDGE_URL || '',
    bridgeApiKey: process.env.BRIDGE_API_KEY || '',
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  integrations: {
    // API de api-rest-banarica: expone GET /api/v1/almacenes/ público (sin auth),
    // usado para sincronizar almacenes activos como fincas de corbana.
    banaricaBaseUrl: process.env.BANARICA_API_URL || 'https://api-logistica-banarica.vercel.app',
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    // 300 era muy bajo para uso normal de la app (varias pantallas disparan
    // varios GET en paralelo) y se disparaba fácil con el polling de
    // progreso del cargue masivo en partes.
    max: Number(process.env.RATE_LIMIT_MAX || 1000),
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  },

  seedAdmin: {
    usuario: process.env.ADMIN_USUARIO || 'admin',
    email: process.env.ADMIN_EMAIL || 'hmeneses@banarica.com',
    password: process.env.ADMIN_PASSWORD || 'Admin#12345',
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
    apellido: process.env.ADMIN_APELLIDO || 'Sistema',
  },

  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

if (env.db.mode === 'bridge' && (!env.db.bridgeUrl || !env.db.bridgeApiKey)) {
  throw new Error(
    'DB_MODE=bridge requiere BRIDGE_URL y BRIDGE_API_KEY en el .env (ver hosting-tunnel/README.md)',
  );
}
