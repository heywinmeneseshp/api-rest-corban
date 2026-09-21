'use strict';

const crypto = require('node:crypto');

const CODIGOS = ['estacion_meteorologica.ver', 'menu.estacion_meteorologica'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();
    const permisos = PERMISSIONS_SEED.filter((p) => CODIGOS.includes(p.codigo));

    await queryInterface.bulkInsert(
      'permisos',
      permisos.map((p) => ({
        uuid: crypto.randomUUID(),
        codigo: p.codigo,
        nombre: p.nombre,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: CODIGOS } });
  },
};
