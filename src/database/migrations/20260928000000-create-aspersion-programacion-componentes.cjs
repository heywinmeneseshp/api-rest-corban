'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aspersion_programacion_componentes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      aspersion_programacion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'aspersion_programaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      articulo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'articulos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      unidad_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'unidades_medida', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Valor teórico puro de la receta (dosis × hectáreas, sin overrides)
      // — se recalcula solo si cambia la mezcla o las hectáreas de la
      // aspersión; nunca lo toca un ajuste manual (ver
      // aspersionProgramacion.service.js).
      cantidad_calculada: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      // Lo que realmente se va a consumir al ejecutar — nace igual a
      // cantidad_calculada, el operador la puede ajustar por línea.
      cantidad: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aspersion_programacion_componentes');
  },
};
