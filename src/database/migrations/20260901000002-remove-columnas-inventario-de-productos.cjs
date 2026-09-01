'use strict';

// `productos` volvía a ser exclusivo de Maestros/agrícola (combos de
// Logística) — las columnas que Inventarios le había agregado
// (20260826000004-extend-productos-inventario.cjs) se mueven a la nueva
// tabla `articulos` (ver migración siguiente). Verificado contra producción:
// ninguna fila de `productos` tenía `categoria_id` asignado todavía, así que
// no hay dato real que preservar.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('productos', 'stock_maximo');
    await queryInterface.removeColumn('productos', 'stock_minimo');
    await queryInterface.removeColumn('productos', 'maneja_inventario');
    await queryInterface.removeColumn('productos', 'precio_venta');
    await queryInterface.removeColumn('productos', 'costo_compra');
    await queryInterface.removeColumn('productos', 'unidad_medida_id');
    await queryInterface.removeColumn('productos', 'categoria_id');
    await queryInterface.removeColumn('productos', 'descripcion');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('productos', 'descripcion', { type: Sequelize.TEXT, allowNull: true });
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
};
