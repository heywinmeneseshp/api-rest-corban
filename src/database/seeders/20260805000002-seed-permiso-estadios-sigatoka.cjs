'use strict';

const crypto = require('node:crypto');

const ESTADIO_SIGATOKA_PREFIXES = ['estadio_sigatoka.'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const estadioPermisos = PERMISSIONS_SEED.filter((p) =>
      ESTADIO_SIGATOKA_PREFIXES.some((prefix) => p.codigo.startsWith(prefix)),
    );

    await queryInterface.bulkInsert(
      'permisos',
      estadioPermisos.map((p) => ({
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
      [Op.or]: ESTADIO_SIGATOKA_PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
