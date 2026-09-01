'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mezcla_componentes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      mezcla_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezcla_versiones', key: 'id' },
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
      unidad_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'unidades_medida', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      costo_unitario_snapshot: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_total_snapshot: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mezcla_componentes');
  },
};
