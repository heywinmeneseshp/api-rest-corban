'use strict';

// Proyección anual de embolses y cajas: escenarios con nombre (parámetros de rampa, % no cosechado, etc.) y su plan de
// hectáreas nuevas por finca y semana de entrada. No toca las áreas reales de los lotes (lote_area_produccion).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proyeccion_escenarios', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      anio: { type: Sequelize.INTEGER, allowNull: false },
      descripcion: { type: Sequelize.STRING(500), allowNull: true },
      params: { type: Sequelize.JSON, allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('proyeccion_escenarios', ['anio'], { name: 'idx_proy_esc_anio' });

    await queryInterface.createTable('proyeccion_areas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      escenario_id: { type: Sequelize.INTEGER, allowNull: false },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      semana_id: { type: Sequelize.INTEGER, allowNull: false },
      hectareas: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      nota: { type: Sequelize.STRING(255), allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('proyeccion_areas', ['escenario_id'], { name: 'idx_proy_areas_escenario' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('proyeccion_areas');
    await queryInterface.dropTable('proyeccion_escenarios');
  },
};
