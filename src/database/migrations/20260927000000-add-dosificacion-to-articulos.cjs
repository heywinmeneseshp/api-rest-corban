'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dosis máxima recomendada por hectárea para un insumo (ej. "4" si
    // dosisMaximaUnidad es Litros, para "4 L/ha") — puramente informativo/de
    // referencia en la ficha del artículo (categoría INSUMO), no afecta
    // cálculos de stock. Nullable: solo aplica a insumos que se aplican por
    // hectárea (no todos los artículos).
    await queryInterface.addColumn('articulos', 'dosis_maxima_por_hectarea', {
      type: Sequelize.DECIMAL(12, 4),
      allowNull: true,
    });
    await queryInterface.addColumn('articulos', 'dosis_maxima_unidad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('articulos', 'dosis_maxima_unidad_id');
    await queryInterface.removeColumn('articulos', 'dosis_maxima_por_hectarea');
  },
};
