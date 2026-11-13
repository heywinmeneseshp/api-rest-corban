'use strict';

// Programaciones de mantenimiento: último estado ya avisado por correo (PROXIMO | VENCIDO) para no repetir el aviso.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('programaciones_mantenimiento');
    if (!cols.aviso_estado) await queryInterface.addColumn('programaciones_mantenimiento', 'aviso_estado', { type: Sequelize.STRING(10), allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('programaciones_mantenimiento');
    if (cols.aviso_estado) await queryInterface.removeColumn('programaciones_mantenimiento', 'aviso_estado');
  },
};
