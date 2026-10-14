'use strict';

// Colaboradores: correo electrónico.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'email', { type: Sequelize.STRING(150), allowNull: true, after: 'telefono' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colaboradores', 'email');
  },
};
