'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Segundo tipo de dosis relativa (el primero fue X% de otro insumo):
    // cantidad POR GALÓN de mezcla total preparada (ej. ANTIFOAM = 1 g por
    // cada galón). A diferencia del % —que se resuelve con la receta—, este
    // se resuelve con el total a preparar en cada aspersión (ver
    // calcularEscenario en app-corbana y calcularComponentesReceta); en la
    // receta solo se guarda la tasa + un estimado para costos/vistas.
    await queryInterface.addColumn('mezcla_componentes', 'tipo_dosis', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'FIJA',
    });
    await queryInterface.addColumn('mezcla_componentes', 'tasa_por_galon', {
      type: Sequelize.DECIMAL(12, 4),
      allowNull: true,
      comment: 'Cantidad (en la unidad del renglón) por cada galón de mezcla total preparada',
    });
    // Las reglas X% ya guardadas pasan a su tipo explícito.
    await queryInterface.sequelize.query(
      "UPDATE mezcla_componentes SET tipo_dosis = 'PORCENTAJE' WHERE referencia_articulo_id IS NOT NULL",
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_componentes', 'tasa_por_galon');
    await queryInterface.removeColumn('mezcla_componentes', 'tipo_dosis');
  },
};
