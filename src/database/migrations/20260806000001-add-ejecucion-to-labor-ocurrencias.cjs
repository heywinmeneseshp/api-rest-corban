'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('labor_ocurrencias', 'ejecutada_el', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('labor_ocurrencias', 'ejecutada_hora', {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('labor_ocurrencias', 'ejecutada_hora');
    await queryInterface.removeColumn('labor_ocurrencias', 'ejecutada_el');
  },
};