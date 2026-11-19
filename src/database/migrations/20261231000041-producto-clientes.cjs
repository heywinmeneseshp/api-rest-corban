'use strict';

// Productos: clientes a los que se venden (como en Logística, un producto puede ser de varios). Sirve para ver las cajas por cliente.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('productos');
    if (!cols.clientes) await queryInterface.addColumn('productos', 'clientes', { type: Sequelize.JSON, allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('productos');
    if (cols.clientes) await queryInterface.removeColumn('productos', 'clientes');
  },
};
