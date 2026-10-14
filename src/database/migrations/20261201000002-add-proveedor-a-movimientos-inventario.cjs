'use strict';

// Recepción de mercancía: cada entrada puede indicar el proveedor de la factura (opcional).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('movimientos_inventario', 'proveedor_id', { type: Sequelize.INTEGER, allowNull: true, after: 'motivo_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('movimientos_inventario', 'proveedor_id');
  },
};
