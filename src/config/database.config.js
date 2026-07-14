import mysqlHttpBridge from '../database/mysqlHttpBridge.cjs';
import { env } from './env.config.js';

const commonDefine = {
  underscored: true,
  timestamps: true,
};

// Conexión MySQL directa (mysql2) — desarrollo local o hosting/VPS que sí
// permite conexiones externas al puerto 3306.
const directConfig = {
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

// Túnel HTTP hacia tunnel.php en el hosting compartido (ver hosting-tunnel/).
// Cada query viaja como POST HTTPS; dialectModule reemplaza a mysql2 pero
// Sequelize se usa exactamente igual (mismos modelos, mismas queries).
const bridgeConfig = {
  database: env.db.name,
  username: env.db.user,
  password: env.db.password,
  dialect: 'mysql',
  dialectModule: mysqlHttpBridge,
  logging: env.db.logging,
  dialectOptions: {
    bridgeUrl: env.db.bridgeUrl,
    bridgeApiKey: env.db.bridgeApiKey,
    dateStrings: true,
  },
  timezone: '+00:00',
  define: commonDefine,
  // Pool chico: cada conexión "lógica" solo agrega overhead HTTP, no hay
  // límite real de sockets MySQL que cuidar del lado de Node.
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

export const databaseConfig = env.db.mode === 'bridge' ? bridgeConfig : directConfig;

export default databaseConfig;
