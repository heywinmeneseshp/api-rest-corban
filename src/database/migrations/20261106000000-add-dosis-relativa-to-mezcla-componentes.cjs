'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dosis relativa: un insumo puede definirse como el X% de OTRO insumo
    // de la misma receta (ej. HIPOTENSOR SYS = 1% del ACEITE BANOLE) en vez
    // de una cantidad fija — ver utils/dosisRelativa.js. La cantidad
    // efectiva se guarda resuelta en `cantidad`; estas columnas solo
    // guardan la regla para recalcularla cuando cambia la referencia.
    await queryInterface.addColumn('mezcla_componentes', 'referencia_articulo_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'articulos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('mezcla_componentes', 'porcentaje_referencia', {
      type: Sequelize.DECIMAL(8, 4),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_componentes', 'porcentaje_referencia');
    await queryInterface.removeColumn('mezcla_componentes', 'referencia_articulo_id');
  },
};
