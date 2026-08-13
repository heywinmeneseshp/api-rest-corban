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

    // El chequeo automático de migraciones/seeders (ver api/index.js) tiene
    // sentido en Vercel, donde nadie corre `npm run db:migrate` a mano en
    // cada arranque. En desarrollo local, en cambio, `nodemon` reinicia el
    // proceso en cada guardado de archivo — correrlo ahí disparaba una
    // ráfaga de ~8 consultas al túnel por CADA reinicio, contribuyendo a
    // los bloqueos del firewall del hosting. Acá se corre solo si se pide
    // explícitamente con AUTO_MIGRATE=true; para migrar/sembrar en local
    // usá `npm run db:migrate` / `npm run db:seed` a mano.
    if (process.env.AUTO_MIGRATE === 'false') {
      await runPendingMigrationsAndSeeders();
    }

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
