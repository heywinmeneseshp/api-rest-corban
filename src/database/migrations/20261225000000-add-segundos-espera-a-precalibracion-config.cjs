'use strict';

// Segundos que la app de campo bloquea las cintas tras contar un racimo (evita contarlo dos veces). Configurable global y por finca.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('precalibracion_config', 'segundos_espera', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('precalibracion_config', 'segundos_espera');
  },
};
