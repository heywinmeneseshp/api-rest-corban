'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    await queryInterface.bulkInsert(
      'permisos',
      PERMISSIONS_SEED.map((p) => ({
        uuid: crypto.randomUUID(),
        codigo: p.codigo,
        nombre: p.nombre,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', null, {});
  },
};
