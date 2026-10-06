'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // La tasa de la dosis POR_GALON pasa a llevar su propia unidad de
    // volumen (por galón, por litro, ...) en vez de asumir galones:
    // `tasa` (en la unidad del renglón) por cada `tasa_unidad_id`.
    await queryInterface.renameColumn('mezcla_componentes', 'tasa_por_galon', 'tasa');
    await queryInterface.addColumn('mezcla_componentes', 'tasa_unidad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('mezcla_componentes', 'tasa_unidad_id');
    await queryInterface.renameColumn('mezcla_componentes', 'tasa', 'tasa_por_galon');
  },
};
