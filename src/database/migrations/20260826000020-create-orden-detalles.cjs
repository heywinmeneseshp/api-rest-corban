'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS orden_detalles
    await queryInterface.createTable('orden_detalles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      almacen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('orden_detalles', ['orden_id']);
    await queryInterface.addIndex('orden_detalles', ['producto_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orden_detalles');
  },
};
