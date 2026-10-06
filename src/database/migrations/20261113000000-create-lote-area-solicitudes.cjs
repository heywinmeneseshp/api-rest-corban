'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Solicitudes de cambio de área (modal "Área de lotes pendiente de
    // confirmar"): lo que envía un usuario sin permiso de aprobar queda
    // PENDIENTE hasta que alguien con area_lote.aprobar la apruebe (se aplica
    // al lote) o la rechace (el lote vuelve a quedar pendiente de confirmar).
    await queryInterface.createTable('lote_area_solicitudes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      lote_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'lotes', key: 'id' } },
      finca_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fincas', key: 'id' } },
      area_total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      area_produccion: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      fecha_solicitud: { type: Sequelize.DATEONLY, allowNull: false },
      estado: { type: Sequelize.ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA'), allowNull: false, defaultValue: 'PENDIENTE' },
      solicitado_por: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_por: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_at: { type: Sequelize.DATE, allowNull: true },
      motivo_rechazo: { type: Sequelize.STRING(300), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('lote_area_solicitudes', ['estado', 'lote_id'], { name: 'idx_lote_area_solicitudes_estado_lote' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lote_area_solicitudes');
  },
};
