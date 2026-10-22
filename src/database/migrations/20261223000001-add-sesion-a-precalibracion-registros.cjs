'use strict';

// Cada racimo apto pertenece (opcionalmente) a una sesión. Los registros anteriores quedan sin sesión.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('precalibracion_registros', 'sesion_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addIndex('precalibracion_registros', ['sesion_id'], { name: 'idx_precal_reg_sesion' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('precalibracion_registros', 'idx_precal_reg_sesion');
    await queryInterface.removeColumn('precalibracion_registros', 'sesion_id');
  },
};
