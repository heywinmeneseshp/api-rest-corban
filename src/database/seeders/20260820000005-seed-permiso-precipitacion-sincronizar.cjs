'use strict';

const crypto = require('node:crypto');

// Permiso propio para resolver inconsistencias entre Precipitación Diaria y
// Clima (botones "Usar Precipitación Diaria"/"Usar Clima") — separado de
// CONFIGURAR, que sigue siendo solo para programar la captura obligatoria.
// Sin backfill a propósito: se asigna a mano desde Maestros → Roles.
const CODIGO = 'precipitacion_diaria.sincronizar_precipitaciones';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const permiso = PERMISSIONS_SEED.find((p) => p.codigo === CODIGO);
    await queryInterface.bulkInsert('permisos', [{
      uuid: crypto.randomUUID(),
      codigo: permiso.codigo,
      nombre: permiso.nombre,
      created_at: now,
      updated_at: now,
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: CODIGO });
  },
};
