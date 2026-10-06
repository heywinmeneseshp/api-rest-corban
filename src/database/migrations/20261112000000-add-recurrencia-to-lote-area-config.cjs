'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cada cuánto se vuelve a pedir el dato una vez cumplida la campaña:
    // UNA_VEZ se desactiva sola al completarse; las demás avanzan su
    // fecha_objetivo automáticamente (ver loteAreaConfig.service.js).
    await queryInterface.addColumn('lote_area_config', 'recurrencia', {
      type: Sequelize.ENUM('UNA_VEZ', 'SEMANAL', 'QUINCENAL', 'MENSUAL'),
      allowNull: false,
      defaultValue: 'UNA_VEZ',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lote_area_config', 'recurrencia');
  },
};