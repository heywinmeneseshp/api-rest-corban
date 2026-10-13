'use strict';

// Eliminación lógica (soft delete) de códigos FRAC.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('frac_codigos', 'deleted_at', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('frac_codigos', 'deleted_at');
  },
};
