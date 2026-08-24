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

    const existentes = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo LIKE 'motivo_repique.%' OR codigo LIKE 'motivo_recuse.%' OR codigo LIKE 'racimo_movimiento.%'`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const yaExisten = new Set(existentes.map((r) => r.codigo));
    const pendientes = racimosPermisos.filter((p) => !yaExisten.has(p.codigo));
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
      [Op.or]: RACIMOS_PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
