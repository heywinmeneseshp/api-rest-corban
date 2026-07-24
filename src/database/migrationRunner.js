import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Sequelize, QueryTypes } from 'sequelize';
import { sequelize } from './connection.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDERS_DIR = path.join(__dirname, 'seeders');
const META_TABLE = 'SequelizeMeta';
const SEED_TABLE = 'SequelizeData';

// El primer usuario administrador ya no se crea desde variables de entorno:
// se pide por un asistente de configuración inicial en el front (ver
// /sistema/setup). Estos dos seeders quedan excluidos del arranque
// automático para que la base no tenga ningún usuario todavía y el
// asistente se muestre — siguen disponibles para `npm run db:seed` manual
// si alguna vez se necesita el flujo viejo (ej. entornos de test).
const SEEDERS_EXCLUIDOS_DEL_AUTORUN = new Set([
  '20260101000004-seed-admin-user.cjs',
  '20260101000005-seed-usuarios-roles.cjs',
]);

const listFiles = (dir, { excluir } = {}) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.cjs'))
    .filter((f) => !excluir?.has(f))
    .sort();

async function ensureTrackingTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const exists = tables.some((t) => String(t).toLowerCase() === tableName.toLowerCase());
  if (!exists) {
    await queryInterface.createTable(tableName, {
      name: { type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true },
    });
  }
}

async function getApplied(tableName) {
  const rows = await sequelize.query(`SELECT name FROM \`${tableName}\``, { type: QueryTypes.SELECT });
  return new Set(rows.map((r) => r.name));
}

async function applyPending({ dir, trackingTable, label, excluir }) {
  const queryInterface = sequelize.getQueryInterface();
  await ensureTrackingTable(queryInterface, trackingTable);

  const aplicados = await getApplied(trackingTable);
  const pendientes = listFiles(dir, { excluir }).filter((f) => !aplicados.has(f));

  for (const file of pendientes) {
    logger.info(`Ejecutando ${label} pendiente: ${file}`);
    const modulo = require(path.join(dir, file));
    try {
      await modulo.up(queryInterface, Sequelize);
    } catch (error) {
      // Se relanza con un mensaje propio (en vez de dejar pasar el error tal
      // cual) porque Sequelize pisa `.stack` con uno genérico sin texto real
      // al reenviar errores de MySQL — así el motivo real queda visible en
      // los logs sin depender de esa particularidad.
      throw new Error(`Fallo aplicando ${label} '${file}': ${error.message || error}`);
    }
    try {
      // `bind` (no `replacements`): el valor viaja separado del texto del
      // SQL en vez de quedar embebido como string literal. Importa acá
      // porque el túnel bloquea cualquier SQL que contenga como palabra
      // suelta "DROP/TRUNCATE/GRANT/REVOKE/RENAME" — con `replacements`,
      // un nombre de archivo (o cualquier dato) que contenga alguna de esas
      // palabras (ej. "...-rename-....cjs") queda embebido en el SQL final
      // y dispara un falso positivo del filtro.
      await sequelize.query(`INSERT INTO \`${trackingTable}\` (name) VALUES ($1)`, { bind: [file] });
    } catch (error) {
      throw new Error(
        `'${file}' se aplicó pero falló al registrarlo en ${trackingTable} (se reintentará en el próximo arranque): ${error.message || error}`,
      );
    }
  }

  if (pendientes.length > 0) {
    logger.info(`${pendientes.length} ${label}(s) aplicado(s) automáticamente al iniciar`);
  }
  return pendientes.length;
}

// Corre migraciones y seeders pendientes contra la base de datos, usando las
// MISMAS tablas de control que sequelize-cli (SequelizeMeta/SequelizeData) —
// así que es compatible con correr `npm run db:migrate`/`db:seed` a mano en
// cualquier momento: lo que ya se aplicó de un lado, el otro lo detecta como
// hecho y lo salta. Pensado para llamarse en cada arranque (ver api/index.js
// y server.js): si la base ya tiene todo aplicado, es prácticamente gratis
// (un par de SELECT).
//
// Nota: no hay lock entre invocaciones concurrentes (dos arranques "fríos"
// de Vercel al mismo tiempo podrían pisarse en la primera migración). Es un
// riesgo acotado a los primeros segundos después de un deploy con la base
// vacía, se decidió no complicar el adaptador del túnel con eso.
export const runPendingMigrationsAndSeeders = async () => {
  const migraciones = await applyPending({ dir: MIGRATIONS_DIR, trackingTable: META_TABLE, label: 'migración' });
  const seeders = await applyPending({
    dir: SEEDERS_DIR,
    trackingTable: SEED_TABLE,
    label: 'seeder',
    excluir: SEEDERS_EXCLUIDOS_DEL_AUTORUN,
  });
  if (migraciones === 0 && seeders === 0) {
    logger.info('Base de datos al día: no había migraciones ni seeders pendientes');
  }
};

export default runPendingMigrationsAndSeeders;
