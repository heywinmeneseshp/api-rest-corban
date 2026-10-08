'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Clasificación FRAC (Fungicide Resistance Action Committee) del ingrediente activo.
    await queryInterface.addColumn('ingredientes_activos', 'frac_codigo', { type: Sequelize.STRING(10), allowNull: true });
    await queryInterface.addColumn('ingredientes_activos', 'grupo_quimico', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('ingredientes_activos', 'modo_accion', { type: Sequelize.STRING(255), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ingredientes_activos', 'frac_codigo');
    await queryInterface.removeColumn('ingredientes_activos', 'grupo_quimico');
    await queryInterface.removeColumn('ingredientes_activos', 'modo_accion');
  },
};
