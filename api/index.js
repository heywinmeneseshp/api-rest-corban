import { app } from '../src/app.js';
import { setupAssociations } from '../src/database/associations.js';
import { testConnection } from '../src/database/connection.js';
import { runPendingMigrationsAndSeeders } from '../src/database/migrationRunner.js';
import { logger } from '../src/utils/logger.js';

// En Vercel (serverless) no hay `app.listen()`: cada invocación reusa el
// mismo contenedor mientras esté "caliente", así que la inicialización
// (asociaciones de Sequelize + verificación de conexión a la BD) se hace
// una sola vez por contenedor, no en cada request.
let initPromise = null;

const ensureInit = () => {
  if (!initPromise) {
    initPromise = (async () => {
      setupAssociations();
      await testConnection();
      await runPendingMigrationsAndSeeders();
    })().catch((error) => {
      initPromise = null; // permite reintentar en la siguiente invocación
      throw error;
    });
  }
  return initPromise;
};

export default async function handler(req, res) {
  try {
    await ensureInit();
  } catch (error) {
    logger.error('Error de inicialización en función serverless', {
      message: error.message,
      stack: error.stack,
    });
    res.status(503).json({
      success: false,
      message: 'Servicio no disponible: fallo al inicializar la conexión a la base de datos',
      errors: [],
    });
    return;
  }
  app(req, res);
}
