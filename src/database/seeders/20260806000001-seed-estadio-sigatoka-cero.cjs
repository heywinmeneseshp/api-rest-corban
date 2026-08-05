'use strict';

const crypto = require('node:crypto');

// Estadio 0 = "sin estadio" (la app móvil lo envía como cadena vacía). Se
// agrega por separado porque la escala original se sembró sin él; para
// instalaciones nuevas ya viene incluido en el seeder principal.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const existente = await queryInterface.sequelize.query(
      "SELECT id FROM estadios_sigatoka WHERE estadio = '0' LIMIT 1",
      { type: QueryTypes.SELECT },
    );
    if (existente.length > 0) return;

    await queryInterface.bulkInsert('estadios_sigatoka', [
      {
        uuid: crypto.randomUUID(),
        estadio: '0',
        valor: 0,
        orden: 0,
        estado: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('estadios_sigatoka', { estadio: '0' });
  },
};
