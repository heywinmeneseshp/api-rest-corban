'use strict';

// Fincas donde no se permite tomar asistencia (no aparecen en la app y se rechazan sus marcaciones). Por defecto todas permiten.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('fincas', 'permite_asistencia', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('fincas', 'permite_asistencia');
  },
};
