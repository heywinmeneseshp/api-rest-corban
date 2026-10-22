'use strict';

// Sesión de precalibración: lo que hace un precalibrador en un lote, de que inicia a que finaliza, con su modalidad
// (VIGENTE: se precalibra la semana del corte; ANTICIPADA: una semana antes del corte) y el potencial de cosecha
// calculado al cerrarla. El celular genera el uuid (así reenviar desde la cola offline no la duplica).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precalibracion_sesiones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      lote_id: { type: Sequelize.INTEGER, allowNull: false },
      // Semana en que se hizo la sesión (la de su fecha de inicio).
      semana_id: { type: Sequelize.INTEGER, allowNull: false },
      tipo: { type: Sequelize.ENUM('VIGENTE', 'ANTICIPADA'), allowNull: false, defaultValue: 'VIGENTE' },
      inicio_at: { type: Sequelize.DATE, allowNull: false },
      fin_at: { type: Sequelize.DATE, allowNull: true },
      // Potencial de cosecha calculado al cerrar la sesión (racimos y cajas estimados de la finca en esa semana).
      potencial_racimos: { type: Sequelize.INTEGER, allowNull: true },
      potencial_cajas: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('precalibracion_sesiones', ['finca_id', 'semana_id'], { name: 'idx_precal_ses_finca_semana' });
    await queryInterface.addIndex('precalibracion_sesiones', ['lote_id', 'inicio_at'], { name: 'idx_precal_ses_lote_inicio' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precalibracion_sesiones');
  },
};
