'use strict';

// Un registro por cada racimo "apto" de la precalibración (cumple la medida del calibrador físico), tomado en
// campo desde la app móvil. La cinta no se guarda: es la semana de embolse (de ahí salen color y edad).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precalibracion_registros', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      // El móvil genera el uuid: así reenviar un registro (cola offline) no lo duplica.
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      lote_id: { type: Sequelize.INTEGER, allowNull: false },
      // Semana en que se embolsó el racimo (define color y edad).
      semana_embolse_id: { type: Sequelize.INTEGER, allowNull: false },
      // Semana en que se hizo la precalibración (la de la fecha del registro).
      semana_id: { type: Sequelize.INTEGER, allowNull: false },
      // Valor del calibrador físico entregado al colaborador (32, 34, 36...).
      valor: { type: Sequelize.STRING(10), allowNull: false },
      fecha_hora: { type: Sequelize.DATE, allowNull: false },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('precalibracion_registros', ['finca_id', 'semana_id'], { name: 'idx_precal_finca_semana' });
    await queryInterface.addIndex('precalibracion_registros', ['lote_id', 'semana_id'], { name: 'idx_precal_lote_semana' });
    await queryInterface.addIndex('precalibracion_registros', ['semana_embolse_id'], { name: 'idx_precal_semana_embolse' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precalibracion_registros');
  },
};
