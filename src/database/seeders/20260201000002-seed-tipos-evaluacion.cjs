'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'tipos_evaluacion',
      [
        { nombre: 'Sigatoka Negra', descripcion: 'Evaluación de infección por Sigatoka Negra' },
        { nombre: 'Emisión Foliar', descripcion: 'Evaluación de conteo y suma bruta de hojas' },
        { nombre: 'Fitosanitaria General', descripcion: 'Inspección fitosanitaria general de la planta' },
      ].map((t) => ({
        uuid: crypto.randomUUID(),
        nombre: t.nombre,
        descripcion: t.descripcion,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tipos_evaluacion', null, {});
  },
};
