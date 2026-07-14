import { Sequelize } from 'sequelize';
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
