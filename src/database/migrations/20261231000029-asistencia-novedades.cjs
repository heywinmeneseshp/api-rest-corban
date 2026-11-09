'use strict';

// Novedades de asistencia: ausencias justificadas (vacaciones, incapacidad, permisos, licencias) y compensatorios en horas
// (ganados por trabajar de más y tomados como descanso). El saldo de compensatorio se calcula: ganado − tomado.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asistencia_novedades', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      colaborador_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'colaboradores', key: 'id' } },
      tipo: {
        type: Sequelize.ENUM(
          'VACACIONES',
          'COMPENSATORIO_GANADO',
          'COMPENSATORIO_TOMADO',
          'INCAPACIDAD',
          'PERMISO_REMUNERADO',
          'PERMISO_NO_REMUNERADO',
          'LICENCIA',
          'CALAMIDAD',
        ),
        allowNull: false,
      },
      fecha_desde: { type: Sequelize.DATEONLY, allowNull: false },
      fecha_hasta: { type: Sequelize.DATEONLY, allowNull: false },
      horas: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      referencia: { type: Sequelize.STRING(100), allowNull: true },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('asistencia_novedades', ['colaborador_id', 'fecha_desde']);
    await queryInterface.addIndex('asistencia_novedades', ['tipo']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asistencia_novedades');
  },
};
