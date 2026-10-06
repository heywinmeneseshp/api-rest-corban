'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Orden editable de los insumos de la receta (se reordenan arrastrando
    // mientras no se hayan medido). Se rellena con el id: así el orden actual
    // (el de creación) no cambia, y un insumo nuevo sin `orden` cae al final
    // por su id — ver utils/ordenReceta.js.
    await queryInterface.addColumn('mezcla_componentes', 'orden', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.sequelize.query('UPDATE mezcla_componentes SET orden = id WHERE orden IS NULL');
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_componentes', 'orden');
  },
};
