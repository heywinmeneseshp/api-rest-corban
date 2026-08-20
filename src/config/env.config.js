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
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3306),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
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
    // API de api-rest-banarica: GET /api/v1/almacenes/ y GET
    // /api/v1/programacion-corte exigen el header `api` con esta key (o un
    // login JWT normal, que corbana no usa) — ver checkApiKeyOrJwt en
    // api-rest-banarica/middlewares/auth.handler.js. El valor real de
    // producción se configura desde Maestros → Configuración (ver
    // configuracion.service.js); esto es solo el default si nunca se guardó
    // nada ahí.
    banaricaBaseUrl: process.env.BANARICA_API_URL || 'https://api-logistica-banarica.vercel.app',
    banaricaApiKey: process.env.BANARICA_API_KEY || '',
    // En espejo de banaricaApiKey pero en sentido inverso: la key que
    // api-rest-banarica manda por header `api` para avisarle a Corbana que
    // ya cargó la Programación de Corte de una semana (ver
    // requireApiKey.middleware.js), y para el push de Fincas→Almacenes al
    // revés no hace falta (Corbana llama a Banarica con banaricaApiKey de
    // arriba).
    corbanaApiKey: process.env.CORBANA_API_KEY || '',
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    // 300 era muy bajo para uso normal de la app (varias pantallas disparan
    // varios GET en paralelo) y se disparaba fácil con el polling de
    // progreso del cargue masivo en partes.
    max: Number(process.env.RATE_LIMIT_MAX || 1000),
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  },

  // Clave dedicada solo para PUT /configuraciones/app-version (usada por el
  // script de publish-version, no por personas) — a propósito NO es una
  // cuenta de usuario: si se filtra, el único daño posible es que alguien
  // cambie el aviso de versión de la app, nada más.
  appVersionDeployKey: process.env.APP_VERSION_DEPLOY_KEY || '',

  // Secreto del cron diario de Vercel que recalcula Producción Semanal (ver
  // routes/sistema/cron.routes.js) — Vercel manda este mismo valor en el
  // header Authorization de cada invocación programada si CRON_SECRET está
  // configurada como env var del proyecto.
  cronSecret: process.env.CRON_SECRET || '',

  seedAdmin: {
    usuario: process.env.ADMIN_USUARIO || 'admin',
    email: process.env.ADMIN_EMAIL || 'hmeneses@banarica.com',
    password: process.env.ADMIN_PASSWORD || 'Admin#12345',
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
    apellido: process.env.ADMIN_APELLIDO || 'Sistema',
  },

  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};
