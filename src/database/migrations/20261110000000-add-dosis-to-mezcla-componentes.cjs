'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dosis de referencia POR RENGLÓN (ej. ACEITE BANOLE a 2.0/ha en una
    // mezcla y 1.5/ha en la mayoría): si se configura, manda sobre la dosis
    // del artículo para % sobre dosis, % aumento automático y "Ajustar
    // dosis". Null = usar la del artículo.
    await queryInterface.addColumn('mezcla_componentes', 'dosis_por_hectarea', {
      type: Sequelize.DECIMAL(12, 4),
      allowNull: true,
    });
    await queryInterface.addColumn('mezcla_componentes', 'dosis_unidad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_componentes', 'dosis_unidad_id');
    await queryInterface.removeColumn('mezcla_componentes', 'dosis_por_hectarea');
  },
};
