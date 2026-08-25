'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS orden_mano_obra
    await queryInterface.createTable('orden_mano_obra', {
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
      horas: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      costo_hora: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('orden_mano_obra', ['orden_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orden_mano_obra');
  },
};
