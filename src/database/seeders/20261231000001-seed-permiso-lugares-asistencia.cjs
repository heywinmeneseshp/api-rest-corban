'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Permiso «Gestionar lugares de asistencia» (asistencia.lugares): crear, editar y desactivar oficinas y otros lugares donde se
  // marca asistencia. Sin rol asignado: se da desde Maestros > Roles (el Administrador siempre puede).
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const codigo = PERMISSIONS.ASISTENCIA_LUGARES;
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :codigo', {
      replacements: { codigo },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (existe) return;
    const permiso = PERMISSIONS_SEED.find((p) => p.codigo === codigo);
    const now = new Date();
    await queryInterface.bulkInsert('permisos', [{ uuid: crypto.randomUUID(), codigo, nombre: permiso.nombre, created_at: now, updated_at: now }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'asistencia.lugares' });
  },
};
