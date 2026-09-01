'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('movimientos_inventario', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      documento: { type: Sequelize.STRING(50), allowNull: false, comment: 'Número de documento único (ENT-0001, SAL-0001, etc.)' },
      tipo: {
        type: Sequelize.ENUM('ENTRADA', 'SALIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'ELABORACION_SALIDA', 'ELABORACION_ENTRADA'),
        allowNull: false,
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      almacen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.DECIMAL(12, 2), allowNull: false, comment: 'Cantidad en unidad del movimiento (siempre positiva, el tipo define el signo)' },
      cantidad_base: { type: Sequelize.DECIMAL(12, 2), allowNull: false, comment: 'Cantidad convertida a unidad base del producto' },
      unidad_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'unidades_medida', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      lote: { type: Sequelize.STRING(50), allowNull: true },
      fecha_vencimiento: { type: Sequelize.DATEONLY, allowNull: true },
      motivo_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'motivos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      origen_movimiento_id: { type: Sequelize.INTEGER, allowNull: true, comment: 'Para transferencias/elaboraciones: id del movimiento origen' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('movimientos_inventario', ['almacen_id', 'producto_id']);
    await queryInterface.addIndex('movimientos_inventario', ['producto_id']);
    await queryInterface.addIndex('movimientos_inventario', ['fecha']);
    await queryInterface.addIndex('movimientos_inventario', ['documento']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('movimientos_inventario');
  },
};
