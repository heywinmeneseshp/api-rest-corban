'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'categorias_planta',
      [
        { nombre: 'Puyones', descripcion: 'Puyón (hijuelo) — categoría usada para la evaluación de Suma Bruta' },
        { nombre: 'Edad de Cosecha', descripcion: 'Planta en edad de cosecha — categoría usada para la evaluación de Conteo de Hojas' },
      ].map((c) => ({
        uuid: crypto.randomUUID(),
        nombre: c.nombre,
        descripcion: c.descripcion,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categorias_planta', { nombre: ['Puyones', 'Edad de Cosecha'] });
  },
};
