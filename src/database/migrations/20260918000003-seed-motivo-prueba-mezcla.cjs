'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('motivos', [
      {
        uuid: crypto.randomUUID(),
        codigo: 'PRUEBA_MEZCLA',
        nombre: 'Prueba de Mezcla',
        descripcion: 'Consumo de insumos en una prueba de laboratorio de Mezclas (ver mezcla.service.js#finalizarPrueba).',
        tipo: 'SALIDA',
        requiere_observacion: 0,
        estado: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('motivos', { codigo: 'PRUEBA_MEZCLA' });
  },
};
