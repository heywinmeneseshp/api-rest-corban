'use strict';

const crypto = require('node:crypto');

// Permiso nuevo: si el rol lo tiene, cada registro de Precipitación Diaria
// también se copia al mm de `clima` de esa misma finca+fecha (ver
// precipitacionDiaria.service.js#registrar). Sin backfill a propósito: es
// una acción con efecto en otra tabla, se asigna a mano desde Maestros →
// Roles → Permisos al rol que corresponda.
const CODIGO = 'precipitacion_diaria.propagar_clima';

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
