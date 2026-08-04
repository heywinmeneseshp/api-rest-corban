'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('labor_series', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      labor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'labores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      finca_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'fincas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // UNICO: usa lote_id. ROTACION/SIMULTANEO: usan labor_serie_lotes y
      // lote_id queda null.
      modo_lotes: {
        type: Sequelize.ENUM('UNICO', 'ROTACION', 'SIMULTANEO'),
        allowNull: false,
        defaultValue: 'UNICO',
      },
      lote_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'lotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_inicio: { type: Sequelize.DATEONLY, allowNull: false },
      hora: { type: Sequelize.TIME, allowNull: true },
      duracion_minutos: { type: Sequelize.INTEGER, allowNull: true },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.STRING(500), allowNull: true },
      es_recurrente: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      frecuencia: {
        type: Sequelize.ENUM('DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL'),
        allowNull: true,
      },
      intervalo: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      // "Finalizar nunca" = fecha_fin y num_repeticiones ambos null (el
      // horizonte de materialización lo limita igual, ver src/utils/recurrencia.js).
      fecha_fin: { type: Sequelize.DATEONLY, allowNull: true },
      num_repeticiones: { type: Sequelize.INTEGER, allowNull: true },
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

    await queryInterface.addIndex('labor_series', ['finca_id'], { name: 'idx_labor_series_finca' });
    await queryInterface.addIndex('labor_series', ['lote_id'], { name: 'idx_labor_series_lote' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('labor_series');
  },
};
