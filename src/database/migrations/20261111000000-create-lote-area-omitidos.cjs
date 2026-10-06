'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Lotes ocultados del pendiente de área (modal "Área de lotes pendiente
    // de confirmar"): se quitan de la vista sin borrar el lote — por eso no
    // hay protecciones por registros asociados. Alcance por campaña
    // (finca + fecha_objetivo): en una campaña nueva vuelven a aparecer.
    await queryInterface.createTable('lote_area_omitidos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      lote_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'lotes', key: 'id' } },
      finca_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fincas', key: 'id' } },
      fecha_objetivo: { type: Sequelize.DATEONLY, allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('lote_area_omitidos', ['lote_id', 'fecha_objetivo'], {
      unique: true,
      name: 'uq_lote_area_omitidos_lote_fecha',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lote_area_omitidos');
  },
};