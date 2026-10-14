'use strict';

// Colaboradores: apellido separado del nombre (nombre, apellido, identificación y finca predeterminada).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'apellido', { type: Sequelize.STRING(150), allowNull: true, after: 'nombre' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colaboradores', 'apellido');
  },
};
