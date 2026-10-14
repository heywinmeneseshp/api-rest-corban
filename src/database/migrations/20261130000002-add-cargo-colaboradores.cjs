'use strict';

// Colaboradores: cargo.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'cargo', { type: Sequelize.STRING(100), allowNull: true, after: 'email' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colaboradores', 'cargo');
  },
};
