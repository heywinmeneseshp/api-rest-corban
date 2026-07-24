import { app } from './app.js';
import { env } from './config/env.config.js';
import { testConnection } from './database/connection.js';
import { setupAssociations } from './database/associations.js';
import { runPendingMigrationsAndSeeders } from './database/migrationRunner.js';
import { logger } from './utils/logger.js';

const start = async () => {
  try {
    setupAssociations();
    await testConnection();
    await runPendingMigrationsAndSeeders();

    const server = app.listen(env.port, () => {
      logger.info(`Servidor escuchando en el puerto ${env.port} (${env.nodeEnv})`);
      logger.info(`Documentación disponible en http://localhost:${env.port}/api-docs`);
    });

    const shutdown = (signal) => {
      logger.info(`Señal ${signal} recibida, cerrando servidor...`);
      server.close(() => process.exit(0));
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Error al iniciar el servidor', { message: error.message, stack: error.stack });
    process.exit(1);
  }
};

start();
