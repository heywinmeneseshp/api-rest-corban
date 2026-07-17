'use strict';

const crypto = require('node:crypto');

const RACIMOS_PREFIXES = ['motivo_repique.', 'motivo_recuse.', 'racimo_movimiento.'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const racimosPermisos = PERMISSIONS_SEED.filter((p) =>
      RACIMOS_PREFIXES.some((prefix) => p.codigo.startsWith(prefix)),
    );

    await queryInterface.bulkInsert(
      'permisos',
      racimosPermisos.map((p) => ({
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
    await queryInterface.bulkDelete('permisos', {
      [Op.or]: RACIMOS_PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
