'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'categorias_planta',
      [
        { nombre: 'Madre', descripcion: 'Planta madre en producción' },
        { nombre: 'Hija', descripcion: 'Planta hija de sucesión' },
        { nombre: 'Nieta', descripcion: 'Planta nieta de sucesión' },
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
    await queryInterface.bulkDelete('categorias_planta', null, {});
  },
};
