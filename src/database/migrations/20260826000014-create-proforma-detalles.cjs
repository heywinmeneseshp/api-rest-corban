'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS proforma_detalles
    await queryInterface.createTable('proforma_detalles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      proforma_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'proformas', key: 'id' },
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
      precio_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_unitario' },
      descuento: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0, comment: 'cantidad*precio - descuento' },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('proforma_detalles', ['proforma_id']);
    await queryInterface.addIndex('proforma_detalles', ['producto_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('proforma_detalles');
  },
};
