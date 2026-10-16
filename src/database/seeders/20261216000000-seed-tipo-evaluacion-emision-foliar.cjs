'use strict';

const crypto = require('node:crypto');

const NOMBRE = 'Emisión Foliar';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existentes] = await queryInterface.sequelize.query(
      'SELECT id FROM tipos_evaluacion WHERE nombre = :nombre',
      { replacements: { nombre: NOMBRE } },
    );
    if (existentes.length > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert('tipos_evaluacion', [
      {
        uuid: crypto.randomUUID(),
        nombre: NOMBRE,
        descripcion: 'Seguimiento semanal de hojas totales y candela de una planta',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tipos_evaluacion', { nombre: NOMBRE });
  },
};
