'use strict';

const crypto = require('node:crypto');

const AREA_LOTE_PREFIXES = ['area_lote.'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const permisos = PERMISSIONS_SEED.filter((p) =>
      AREA_LOTE_PREFIXES.some((prefix) => p.codigo.startsWith(prefix)),
    );

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
    await queryInterface.bulkDelete('permisos', {
      [Op.or]: AREA_LOTE_PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
