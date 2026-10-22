'use strict';

// Tracking GPS de una sesión de precalibración: un punto cada ~5 s o ~5 m mientras la sesión está abierta en la app de campo.
// Sirve para medir cuánto recorrió el trabajador (distancia real, velocidad y tiempo en movimiento).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precalibracion_trazas', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      sesion_id: { type: Sequelize.INTEGER, allowNull: false },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      precision_m: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      registrado_at: { type: Sequelize.DATE(3), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    // Único por sesión y momento: reenviar la cola offline no duplica puntos.
    await queryInterface.addIndex('precalibracion_trazas', ['sesion_id', 'registrado_at'], { unique: true, name: 'uq_precal_traza_sesion_momento' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precalibracion_trazas');
  },
};
