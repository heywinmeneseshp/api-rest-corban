'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cada registro de área pertenece a una SEMANA: lo que se edita hoy queda en
    // la semana actual y, con permiso, se puede editar una semana anterior.
    // `fecha_registro` sigue siendo la fecha real en que se guardó.
    await queryInterface.addColumn('lote_area_produccion', 'semana_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'semanas', key: 'id' },
    });
    await queryInterface.addIndex('lote_area_produccion', ['lote_id', 'semana_id'], { name: 'idx_lote_area_produccion_lote_semana' });

    // Backfill: la semana que contiene la fecha de cada registro existente.
    await queryInterface.sequelize.query(`
      UPDATE lote_area_produccion lap
      JOIN semanas s ON lap.fecha_registro BETWEEN s.fecha_inicio AND s.fecha_fin AND s.deleted_at IS NULL
         SET lap.semana_id = s.id
       WHERE lap.semana_id IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('lote_area_produccion', 'idx_lote_area_produccion_lote_semana');
    await queryInterface.removeColumn('lote_area_produccion', 'semana_id');
  },
};
