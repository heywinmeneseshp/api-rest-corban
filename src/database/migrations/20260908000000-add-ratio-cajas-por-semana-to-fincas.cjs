'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('fincas', 'ratio_cajas_por_semana', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Ratio (cajas por racimo cosechado) editado a mano por numeroSemana, para "Sugerido próximas semanas" en Estimaciones. Formato: {"37": 0.0285, "38": 0.03, ...}',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('fincas', 'ratio_cajas_por_semana');
  },
};
