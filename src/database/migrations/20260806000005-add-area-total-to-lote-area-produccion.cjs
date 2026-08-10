'use strict';

// `area` en esta tabla ya representa el área en producción (histórica,
// fechada). Se agrega `area_total` para poder registrar, en el mismo evento,
// también el área total del lote (`lotes.area`, que no tiene historial) —
// necesario para la config de "Área de Lotes": sin fecha en el área total no
// hay forma de saber si se confirmó después de la fecha objetivo de una
// campaña. Nullable: los registros manuales existentes y los que se sigan
// haciendo sin este dato quedan sin tocar.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lote_area_produccion', 'area_total', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lote_area_produccion', 'area_total');
  },
};
