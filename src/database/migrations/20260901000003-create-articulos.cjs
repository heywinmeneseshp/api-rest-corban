'use strict';

// Separa "Artículos" de Inventarios del "Producto" compartido con Maestros
// (combos de Logística) — pedido explícito del usuario. `producto_categorias`
// pasa a llamarse `articulo_categorias` (ya no tiene ninguna relación con
// `productos` tras la migración anterior) y se crea `articulos` con las
// columnas que Inventarios usaba antes en `productos`.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameTable('producto_categorias', 'articulo_categorias');

    await queryInterface.createTable('articulos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      codigo: { type: Sequelize.STRING(20), allowNull: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      categoria_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'articulo_categorias', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      unidad_medida_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'unidades_medida', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      costo_compra: { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      precio_venta: { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      maneja_inventario: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      stock_minimo: { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
      stock_maximo: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('articulos');
    await queryInterface.renameTable('articulo_categorias', 'producto_categorias');
  },
};
