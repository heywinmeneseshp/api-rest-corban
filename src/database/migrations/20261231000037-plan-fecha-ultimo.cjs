'use strict';

// Planes por días / meses: fecha del último mantenimiento, de donde se cuenta la periodicidad (el siguiente se agenda solo).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('planes_mantenimiento');
    if (!cols.fecha_ultimo) await queryInterface.addColumn('planes_mantenimiento', 'fecha_ultimo', { type: Sequelize.DATEONLY, allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('planes_mantenimiento');
    if (cols.fecha_ultimo) await queryInterface.removeColumn('planes_mantenimiento', 'fecha_ultimo');
  },
};
