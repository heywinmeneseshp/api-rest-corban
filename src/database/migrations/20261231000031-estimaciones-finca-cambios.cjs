'use strict';

// Re-estimaciones: cuando se vuelve a cargar la estimación de una finca para una semana en la misma semana de registro, el cambio queda
// pendiente hasta que un usuario con permiso (o el Administrador) lo aprueba. Mientras tanto sigue vigente la estimación anterior.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estimaciones_finca_cambios', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      estimacion_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'estimaciones_finca', key: 'id' } },
      semana_id: { type: Sequelize.INTEGER, allowNull: false },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      semana_registro_id: { type: Sequelize.INTEGER, allowNull: false },
      cajas_anterior: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      cajas_nueva: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      estado: { type: Sequelize.ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA'), allowNull: false, defaultValue: 'PENDIENTE' },
      motivo_rechazo: { type: Sequelize.TEXT, allowNull: true },
      solicitado_by: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_by: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('estimaciones_finca_cambios', ['estado']);
    await queryInterface.addIndex('estimaciones_finca_cambios', ['estimacion_id', 'estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estimaciones_finca_cambios');
  },
};
