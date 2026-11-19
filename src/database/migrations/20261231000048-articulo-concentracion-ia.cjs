'use strict';

// Insumos de Sanidad Vegetal: concentración del ingrediente activo en gramos por litro (sale en el comprobante de aspersión).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('articulos');
    if (!cols.concentracion_ia) await queryInterface.addColumn('articulos', 'concentracion_ia', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('articulos');
    if (cols.concentracion_ia) await queryInterface.removeColumn('articulos', 'concentracion_ia');
  },
};
