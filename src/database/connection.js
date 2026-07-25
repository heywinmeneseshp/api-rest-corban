import { Sequelize } from 'sequelize';
// Import literal (no dinámico) requerido para que el bundler de Vercel
// (@vercel/nft) detecte e incluya mysql2 en la función serverless: Sequelize
// lo carga internamente con `require(moduleName)` (variable, no string
// literal), lo que el análisis estático de nft no puede rastrear. Sin esto,
// el modo 'direct' falla en producción con "Please install mysql2 package
// manually" aunque mysql2 esté en package.json.
import 'mysql2';
import { env } from '../config/env.config.js';
import { databaseConfig } from '../config/database.config.js';
import { logger } from '../utils/logger.js';

export const sequelize = new Sequelize(
  databaseConfig.database,
  databaseConfig.username,
  databaseConfig.password,
  {
    host: databaseConfig.host,
    port: databaseConfig.port,
    dialect: databaseConfig.dialect,
    dialectModule: databaseConfig.dialectModule,
    dialectOptions: databaseConfig.dialectOptions,
    timezone: databaseConfig.timezone,
    logging: databaseConfig.logging ? (msg) => logger.debug(msg) : false,
    define: databaseConfig.define,
    pool: databaseConfig.pool,
  },
);

export const testConnection = async () => {
  await sequelize.authenticate();
  logger.info(
    `Conexión a la base de datos establecida correctamente (modo: ${env.db.mode})`,
  );
};

export default sequelize;
