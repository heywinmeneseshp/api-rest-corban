'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plantas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      lote_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'lotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      codigo: { type: Sequelize.STRING(30), allowNull: false },
      categoria_planta_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'categorias_planta', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      latitud: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      longitud: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('plantas', ['lote_id'], { name: 'idx_plantas_lote_id' });
    await queryInterface.addIndex('plantas', ['categoria_planta_id'], {
      name: 'idx_plantas_categoria_planta_id',
    });
    await queryInterface.addIndex('plantas', ['lote_id', 'codigo'], {
      name: 'uq_plantas_lote_codigo',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plantas');
  },
};
