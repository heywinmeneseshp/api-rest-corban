require('dotenv/config');

const mysqlHttpBridge = require('./mysqlHttpBridge.cjs');

const mode = process.env.DB_MODE === 'bridge' ? 'bridge' : 'direct';

const commonDefine = {
  underscored: true,
  timestamps: true,
};   

const directConfig = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'corbana_sanitario',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  dialectOptions: {
    dateStrings: true,
    typeCast: true,
  },
  timezone: '+00:00',
  define: commonDefine,
};

// Túnel HTTP hacia tunnel.php en el hosting compartido (ver hosting-tunnel/).
// Nota: el tunnel bloquea DROP/TRUNCATE/GRANT/REVOKE/RENAME por seguridad,
// pero permite CREATE/ALTER, así que `db:migrate` funciona normalmente;
// `db:migrate:undo` fallará si la migración hace DROP TABLE.
const bridgeConfig = {
  username: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  dialect: 'mysql',
  dialectModule: mysqlHttpBridge,
  dialectOptions: {
    bridgeUrl: process.env.BRIDGE_URL,
    bridgeApiKey: process.env.BRIDGE_API_KEY,
    dateStrings: true,
  },
  timezone: '+00:00',
  define: commonDefine,
};

const common = mode === 'bridge' ? bridgeConfig : directConfig;

module.exports = {
  development: common,
  test: common,
  production: common,
};
