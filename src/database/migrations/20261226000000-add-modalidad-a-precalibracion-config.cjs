'use strict';

// Modalidad de la precalibración (VIGENTE: semana del corte; ANTICIPADA: una semana antes). Se define en la configuración
// (global o por finca) y la app de campo la usa al iniciar sesión, sin que el precalibrador la elija.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('precalibracion_config', 'modalidad', { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'VIGENTE' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('precalibracion_config', 'modalidad');
  },
};
