'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const auditoria = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    };
    await queryInterface.createTable('finca_capas_mapa', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      finca_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'fincas', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      lote_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'lotes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      categoria: { type: Sequelize.STRING(20), allowNull: false },
      subtipo: { type: Sequelize.STRING(40), allowNull: true },
      nombre: { type: Sequelize.STRING(150), allowNull: true },
      geometria: { type: Sequelize.STRING(10), allowNull: false },
      coordenadas: { type: Sequelize.JSON, allowNull: false },
      created_by: auditoria,
      updated_by: auditoria,
      deleted_by: auditoria,
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('finca_capas_mapa', ['finca_id', 'categoria'], { name: 'idx_finca_capas_finca_categoria' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('finca_capas_mapa');
  },
};
