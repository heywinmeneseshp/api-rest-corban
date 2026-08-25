'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('elaboraciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      documento: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      mezcla_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezcla_versiones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad_elaborada: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      almacen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      usuario_id: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('elaboraciones');
  },
};
