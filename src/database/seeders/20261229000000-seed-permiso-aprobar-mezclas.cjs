'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Permiso «Aprobar mezclas» (inventario.mezclas.aprobar): además del Administrador y de los roles aprobadores de Parámetros de
  // Mezcla, quien lo tenga puede aprobar una mezcla pendiente.
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const codigo = PERMISSIONS.INVENTARIO_MEZCLAS_APROBAR;
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :codigo', {
      replacements: { codigo },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (existe) return;
    const permiso = PERMISSIONS_SEED.find((p) => p.codigo === codigo);
    const now = new Date();
    await queryInterface.bulkInsert('permisos', [{ uuid: crypto.randomUUID(), codigo, nombre: permiso.nombre, created_at: now, updated_at: now }]);
    // Sin rol asignado a propósito: se asigna desde Maestros > Roles (el Administrador aprueba siempre).
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'inventario.mezclas.aprobar' });
  },
};
