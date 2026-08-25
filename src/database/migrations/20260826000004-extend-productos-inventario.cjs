'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('productos', 'descripcion', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('productos', 'tipo', {
      type: Sequelize.ENUM('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
      allowNull: false,
      defaultValue: 'GENERAL',
    });
    await queryInterface.addColumn('productos', 'categoria_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'producto_categorias', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('productos', 'unidad_medida_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('productos', 'costo_compra', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
    await queryInterface.addColumn('productos', 'precio_venta', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
    await queryInterface.addColumn('productos', 'maneja_inventario', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await queryInterface.addColumn('productos', 'stock_minimo', { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 });
    await queryInterface.addColumn('productos', 'stock_maximo', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('productos', 'stock_maximo');
    await queryInterface.removeColumn('productos', 'stock_minimo');
    await queryInterface.removeColumn('productos', 'maneja_inventario');
    await queryInterface.removeColumn('productos', 'precio_venta');
    await queryInterface.removeColumn('productos', 'costo_compra');
    await queryInterface.removeColumn('productos', 'unidad_medida_id');
    await queryInterface.removeColumn('productos', 'categoria_id');
    await queryInterface.removeColumn('productos', 'tipo');
    await queryInterface.removeColumn('productos', 'descripcion');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS `enum_productos_tipo`;");
  },
};
