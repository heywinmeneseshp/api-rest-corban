'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Nota puntual del operador para una finca+semana en "Cargar
    // estimaciones" — ej. "afectada por lluvias". Opcional, no afecta el
    // cálculo de la estimación.
    await queryInterface.addColumn('estimaciones_finca', 'observaciones', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estimaciones_finca', 'observaciones');
  },
};
