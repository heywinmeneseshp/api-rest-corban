'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'tipos_evaluacion',
      [
        { nombre: 'Índice de infección', descripcion: 'Evaluación de índice de infección de la planta' },
        { nombre: 'Conteo de Hojas', descripcion: 'Evaluación de conteo de hojas funcionales' },
        { nombre: 'Suma Bruta', descripcion: 'Evaluación de suma bruta de hojas' },
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
