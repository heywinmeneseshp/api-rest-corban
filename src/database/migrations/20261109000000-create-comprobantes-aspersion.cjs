'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Comprobante de aplicación: se crea en BORRADOR al ejecutar una
    // aspersión (ver aspersionProgramacion.service.js#ejecutar) y se emite
    // después desde Sanidad Vegetal → Comprobante de aspersiones. Una
    // aspersión ejecutada tiene exactamente un comprobante.
    await queryInterface.createTable('comprobantes_aspersion', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      numero: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      aspersion_programacion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'aspersion_programaciones', key: 'id' },
      },
      estado: { type: Sequelize.ENUM('BORRADOR', 'EMITIDO'), allowNull: false, defaultValue: 'BORRADOR' },
      // Se copia de la aspersión al ejecutar; el piloto lo completa quien
      // ejecuta (modal) o quien revisa el borrador.
      medio: { type: Sequelize.ENUM('AVION', 'DRON'), allowNull: true },
      piloto: { type: Sequelize.STRING(150), allowNull: true },
      hectareas_programadas: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      hectareas_aplicadas: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      galones_totales: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      ejecutado_por_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      ejecutado_en: { type: Sequelize.DATE, allowNull: true },
      emitido_por_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      emitido_en: { type: Sequelize.DATE, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comprobantes_aspersion');
  },
};
