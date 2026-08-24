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

    const existentes = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo LIKE 'estadio_sigatoka.%'`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const yaExisten = new Set(existentes.map((r) => r.codigo));
    const pendientes = estadioPermisos.filter((p) => !yaExisten.has(p.codigo));
    if (pendientes.length === 0) return;

    await queryInterface.bulkInsert(
      'permisos',
      pendientes.map((p) => ({
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
