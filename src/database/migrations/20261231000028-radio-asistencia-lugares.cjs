'use strict';

// Radio de tolerancia de un lugar de asistencia: marcar a más de esta distancia de su punto es marcar fuera del área.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('asistencia_lugares', 'radio_metros', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 150 });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('asistencia_lugares', 'radio_metros');
  },
};
