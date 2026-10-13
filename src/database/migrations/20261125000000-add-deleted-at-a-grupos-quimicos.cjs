'use strict';

// Eliminación lógica (soft delete) de grupos químicos.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('grupos_quimicos', 'deleted_at', { type: Sequelize.DATE, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('grupos_quimicos', 'deleted_at');
  },
};
