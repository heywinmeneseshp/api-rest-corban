'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('labor_ocurrencias', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      serie_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'labor_series', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      hora: { type: Sequelize.TIME, allowNull: true },
      duracion_minutos: { type: Sequelize.INTEGER, allowNull: true },
      // Denormalizado desde la serie al momento de generar la ocurrencia:
      // las vistas de calendario leen directo de aquí sin joins pesados, y
      // si a futuro se cambia el lote/labor de una serie ("esta y las
      // siguientes"), las ocurrencias ya generadas no se alteran.
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
      labor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'labores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.STRING(500), allowNull: true },
      estado: {
        type: Sequelize.ENUM('PROGRAMADA', 'COMPLETADA', 'CANCELADA'),
        allowNull: false,
        defaultValue: 'PROGRAMADA',
      },
      // true si esta ocurrencia se editó independientemente de su serie
      // (fase 3: "editar solo este evento").
      modificada: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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

    await queryInterface.addIndex('labor_ocurrencias', ['finca_id', 'fecha'], {
      name: 'idx_labor_ocurrencias_finca_fecha',
    });
    await queryInterface.addIndex('labor_ocurrencias', ['lote_id', 'fecha'], {
      name: 'idx_labor_ocurrencias_lote_fecha',
    });
    await queryInterface.addIndex('labor_ocurrencias', ['serie_id'], {
      name: 'idx_labor_ocurrencias_serie',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('labor_ocurrencias');
  },
};
