'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mezcla_versiones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      mezcla_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezclas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      version: { type: Sequelize.INTEGER, allowNull: false },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      creada_por: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addConstraint('mezcla_versiones', {
      fields: ['mezcla_id', 'version'],
      type: 'unique',
      name: 'uniq_mezcla_version',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mezcla_versiones');
  },
};
