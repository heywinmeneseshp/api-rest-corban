'use strict';

// Ajustes de estimación hechos desde Precalibración (cajas y ratio calculados con los racimos aptos). Viven en su propia
// tabla: NO tocan las estimaciones de la escalera (estimaciones_finca). Cada guardado es una versión nueva.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precalibracion_estimaciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      // Semana de la precalibración que se está ajustando (la del filtro).
      semana_id: { type: Sequelize.INTEGER, allowNull: false },
      // Racimos aptos de esa semana en el momento de guardar.
      racimos_aptos: { type: Sequelize.INTEGER, allowNull: false },
      ratio: { type: Sequelize.DECIMAL(8, 3), allowNull: true },
      cajas: { type: Sequelize.INTEGER, allowNull: false },
      // Lo que decía la estimación oficial (escalera) al guardar, para poder comparar después.
      estimacion_cajas: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('precalibracion_estimaciones', ['finca_id', 'semana_id', 'created_at'], { name: 'idx_precal_estim_finca_semana' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precalibracion_estimaciones');
  },
};
