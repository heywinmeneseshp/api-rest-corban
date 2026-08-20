import { env } from './env.config.js';

const commonDefine = {
  underscored: true,
  timestamps: true,
};

// Conexión MySQL directa (mysql2).
export const databaseConfig = {
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  dialect: 'mysql',
  logging: env.db.logging,
  // Evita que mysql2 castee DATE/DATEONLY a JS Date usando el timezone local
  // del proceso (causa desfases de un día). Se leen como strings "YYYY-MM-DD".
  dialectOptions: {
    dateStrings: true,
    typeCast: true,
  },
  timezone: '+00:00',
  define: commonDefine,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

export default databaseConfig;
