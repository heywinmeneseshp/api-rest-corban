'use strict';

// Reconcilia el historial de seeders (tabla `SequelizeData`) contra una base
// que puede estar "atrasada" o divergida (copias viejas, restauraciones,
// clones para pruebas): para cada seeder que el CLI todavía no tiene
// marcado como aplicado, lo intenta correr; si falla por duplicate-key (ya
// existía esa data porque en su momento se corrió a mano), lo marca como
// aplicado sin tocar los datos; si falla por otra razón, corta y avisa. Así
// queda lista para que `npm run db:seed` funcione normal de ahí en más.
//
// Uso: apuntar las variables de entorno (DB_HOST/DB_NAME/etc) a la base que
// se quiere reconciliar y correr:
//   node scripts/reconcile-seeders.cjs

require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');

const config = require('../src/database/cli-config.cjs').development;
const SEEDERS_DIR = path.join(__dirname, '..', 'src', 'database', 'seeders');

const isDuplicateError = (err) =>
  err?.name === 'SequelizeUniqueConstraintError' ||
  err?.parent?.code === 'ER_DUP_ENTRY' ||
  err?.original?.code === 'ER_DUP_ENTRY';

async function main() {
  const sequelize = new Sequelize(config);
  await sequelize.authenticate();
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.createTable('SequelizeData', {
    name: { type: Sequelize.STRING, allowNull: false, unique: true, primaryKey: true },
  }).catch(() => {}); // ya existe, seguimos

  const [trackedRows] = await sequelize.query('SELECT name FROM SequelizeData');
  const tracked = new Set(trackedRows.map((r) => r.name));

  const archivos = fs
    .readdirSync(SEEDERS_DIR)
    .filter((f) => /^(?!.*\.d\.ts$).*\.(cjs|js)$/.test(f))
    .sort();

  console.log(`Seeders en disco: ${archivos.length} — ya trackeados: ${tracked.size}`);

  let aplicados = 0;
  let yaExistian = 0;

  for (const archivo of archivos) {
    if (tracked.has(archivo)) continue;

    const seeder = require(path.join(SEEDERS_DIR, archivo));
    process.stdout.write(`- ${archivo}: `);
    try {
      await seeder.up(queryInterface, Sequelize);
      await sequelize.query('INSERT INTO SequelizeData (name) VALUES (?)', { replacements: [archivo] });
      aplicados++;
      console.log('aplicado (era nuevo)');
    } catch (err) {
      if (isDuplicateError(err)) {
        await sequelize.query('INSERT INTO SequelizeData (name) VALUES (?)', { replacements: [archivo] });
        yaExistian++;
        console.log('ya existía la data — marcado como aplicado');
      } else {
        console.log('ERROR — se corta acá, revisar antes de seguir');
        console.error(err);
        process.exit(1);
      }
    }
  }

  console.log(`\nListo. Nuevos aplicados: ${aplicados}. Ya existentes (solo marcados): ${yaExistian}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
