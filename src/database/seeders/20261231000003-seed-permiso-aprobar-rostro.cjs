'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Permiso «Aprobar nuevos registros de rostro y quitar rostros» (asistencia.aprobar_rostro): volver a enrolar un rostro ya
  // registrado queda pendiente hasta que otro usuario con este permiso lo apruebe. Sin rol asignado (se da desde Maestros > Roles).
  // También renombra «Marcar mi propia asistencia»: ahora cualquiera puede marcar con su rostro en el equipo de quien tenga el
  // permiso (kiosco), y ese usuario solo ve lo suyo.
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const codigo = PERMISSIONS.ASISTENCIA_APROBAR_ROSTRO;
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :codigo', {
      replacements: { codigo },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (!existe) {
      const permiso = PERMISSIONS_SEED.find((p) => p.codigo === codigo);
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [{ uuid: crypto.randomUUID(), codigo, nombre: permiso.nombre, created_at: now, updated_at: now }]);
    }
    const marcar = PERMISSIONS_SEED.find((p) => p.codigo === PERMISSIONS.ASISTENCIA_MARCAR);
    await queryInterface.sequelize.query('UPDATE permisos SET nombre = :nombre WHERE codigo = :codigo', { replacements: { nombre: marcar.nombre, codigo: marcar.codigo } });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'asistencia.aprobar_rostro' });
  },
};
