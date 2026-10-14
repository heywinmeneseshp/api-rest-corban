'use strict';

// Rampa por entrada de hectáreas nuevas: % del embolse por hectárea con el que arranca y semanas hasta llegar al 100 %.
// NULL = usa los valores por defecto del escenario (params.rampaPct / params.rampaSemanas).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('proyeccion_areas', 'rampa_pct', { type: Sequelize.DECIMAL(5, 2), allowNull: true, after: 'hectareas' });
    await queryInterface.addColumn('proyeccion_areas', 'rampa_semanas', { type: Sequelize.INTEGER, allowNull: true, after: 'rampa_pct' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('proyeccion_areas', 'rampa_semanas');
    await queryInterface.removeColumn('proyeccion_areas', 'rampa_pct');
  },
};
