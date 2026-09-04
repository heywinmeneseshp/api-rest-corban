'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('fincas', 'patron_corte_pct', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Overrides de % aplicado por edad (8-12) en el estimado de corte, guardados por finca. Formato: {"8": 0.06, "9": 12.05, ...}',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('fincas', 'patron_corte_pct');
  },
};
