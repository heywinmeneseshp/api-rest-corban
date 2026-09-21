'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Distingue una etapa de medición normal (o de incorporar un
    // componente de la receta) de una corrección puntual de pH — pedido
    // explícito: el regulador de pH usado para corregir NO debe quedar en
    // la receta permanente (mezcla_componentes), así que se registra acá,
    // en la propia etapa.
    await queryInterface.addColumn('mezcla_etapas', 'tipo_etapa', {
      type: Sequelize.ENUM('MEDICION', 'CORRECCION_PH'),
      allowNull: false,
      defaultValue: 'MEDICION',
    });

    await queryInterface.addColumn('mezcla_etapas', 'articulo_correccion_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'articulos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addColumn('mezcla_etapas', 'cantidad_correccion', {
      type: Sequelize.DECIMAL(12, 4),
      allowNull: true,
    });

    await queryInterface.addColumn('mezcla_etapas', 'unidad_correccion_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_etapas', 'unidad_correccion_id');
    await queryInterface.removeColumn('mezcla_etapas', 'cantidad_correccion');
    await queryInterface.removeColumn('mezcla_etapas', 'articulo_correccion_id');
    await queryInterface.removeColumn('mezcla_etapas', 'tipo_etapa');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_mezcla_etapas_tipo_etapa";').catch(() => {});
  },
};
