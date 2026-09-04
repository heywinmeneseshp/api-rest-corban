'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS } = await import('../../constants/permissions.constants.js');
    const now = new Date();
    const codigo = PERMISSIONS.ESTIMACION_ACTUALIZAR_MASIVO;
    // El permiso fue retirado por la migración de restructuración de
    // permisos de Estimaciones (20260909000000) — si ya no existe en las
    // constantes, este seeder queda como no-op.
    if (!codigo) return;
    const existente = await queryInterface.sequelize.query(
      `SELECT id FROM permisos WHERE codigo = '${codigo}' LIMIT 1;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (existente.length > 0) return;
    await queryInterface.bulkInsert('permisos', [
      {
        uuid: crypto.randomUUID(),
        codigo,
        nombre: 'Actualizar en bloque estimaciones de fincas ya cargadas',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    const { PERMISSIONS } = await import('../../constants/permissions.constants.js');
    await queryInterface.bulkDelete('permisos', { codigo: PERMISSIONS.ESTIMACION_ACTUALIZAR_MASIVO });
  },
};
