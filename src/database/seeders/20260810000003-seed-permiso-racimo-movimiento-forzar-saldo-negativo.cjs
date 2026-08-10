'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const permiso = PERMISSIONS_SEED.find((p) => p.codigo === PERMISSIONS.RACIMO_MOVIMIENTO_FORZAR_SALDO_NEGATIVO);

    await queryInterface.bulkInsert('permisos', [
      {
        uuid: crypto.randomUUID(),
        codigo: permiso.codigo,
        nombre: permiso.nombre,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'racimo_movimiento.forzar_saldo_negativo' });
  },
};
