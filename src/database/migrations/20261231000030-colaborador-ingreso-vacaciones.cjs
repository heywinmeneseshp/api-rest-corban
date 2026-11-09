'use strict';

// Vacaciones: fecha de ingreso del colaborador (causa 15 días hábiles por año, proporcional día a día) y días hábiles ya
// disfrutados antes de registrar las vacaciones en el sistema.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'fecha_ingreso', { type: Sequelize.DATEONLY, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'vacaciones_previas', { type: Sequelize.DECIMAL(6, 2), allowNull: false, defaultValue: 0 });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colaboradores', 'vacaciones_previas');
    await queryInterface.removeColumn('colaboradores', 'fecha_ingreso');
  },
};
