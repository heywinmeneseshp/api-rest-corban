'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('racimo_movimientos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      finca_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'fincas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      lote_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'lotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Semana en la que se embolsó el racimo: identifica la cohorte y no
      // cambia en el resto de movimientos de esa misma cohorte.
      semana_embolse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Semana en la que se registra ESTE movimiento (puede ser la misma de
      // embolse o una posterior, para repique/recuse/corte).
      semana_registro_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo: {
        type: Sequelize.ENUM('EMBOLSE', 'REPIQUE', 'RECUSE', 'CORTE'),
        allowNull: false,
      },
      motivo_repique_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'motivos_repique', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      motivo_recuse_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'motivos_recuse', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      observacion: { type: Sequelize.STRING(255), allowNull: true },
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

    await queryInterface.addIndex('racimo_movimientos', ['finca_id', 'lote_id', 'semana_embolse_id'], {
      name: 'idx_racimo_mov_cohorte',
    });
    await queryInterface.addIndex('racimo_movimientos', ['semana_registro_id'], {
      name: 'idx_racimo_mov_semana_registro',
    });
    await queryInterface.addIndex('racimo_movimientos', ['tipo'], { name: 'idx_racimo_mov_tipo' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('racimo_movimientos');
  },
};
