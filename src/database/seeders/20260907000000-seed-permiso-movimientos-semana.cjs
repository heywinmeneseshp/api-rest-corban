'use strict';

const crypto = require('node:crypto');

const CLAVE = 'menu.racimos.movimientos_semana';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const [existentes] = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo = '${CLAVE}'`);
    if (existentes.length > 0) return;

    const permiso = PERMISSIONS_SEED.find((p) => p.codigo === CLAVE);
    if (!permiso) return;

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
    await queryInterface.bulkDelete('permisos', { codigo: CLAVE });
  },
};
