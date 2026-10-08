'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = 'comprobantes_aspersion';
    await queryInterface.addColumn(t, 'aeronave', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn(t, 'volumen_aplicacion_ha', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
    await queryInterface.addColumn(t, 'temperatura_inicial', { type: Sequelize.DECIMAL(5, 1), allowNull: true });
    await queryInterface.addColumn(t, 'temperatura_final', { type: Sequelize.DECIMAL(5, 1), allowNull: true });
    await queryInterface.addColumn(t, 'velocidad_viento', { type: Sequelize.DECIMAL(6, 1), allowNull: true });
    await queryInterface.addColumn(t, 'humedad_relativa_final', { type: Sequelize.DECIMAL(5, 1), allowNull: true });
    await queryInterface.addColumn(t, 'hora_inicio', { type: Sequelize.STRING(5), allowNull: true });
    await queryInterface.addColumn(t, 'hora_final', { type: Sequelize.STRING(5), allowNull: true });
  },

  async down(queryInterface) {
    const t = 'comprobantes_aspersion';
    for (const c of ['aeronave', 'volumen_aplicacion_ha', 'temperatura_inicial', 'temperatura_final', 'velocidad_viento', 'humedad_relativa_final', 'hora_inicio', 'hora_final']) {
      await queryInterface.removeColumn(t, c);
    }
  },
};
