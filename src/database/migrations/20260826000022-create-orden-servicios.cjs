'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS orden_servicios
    await queryInterface.createTable('orden_servicios', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ordenes_mantenimiento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      descripcion: { type: Sequelize.STRING(500), allowNull: false },
      proveedor: { type: Sequelize.STRING(150), allowNull: true },
      costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('orden_servicios', ['orden_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orden_servicios');
  },
};
