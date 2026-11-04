'use strict';

// Ejecución parcial con toda la mezcla preparada el primer día: la parte restante queda con `insumos_descontados` para que al
// ejecutarla no se descuente otra vez del inventario.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('aspersion_programaciones', 'insumos_descontados', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aspersion_programaciones', 'insumos_descontados');
  },
};
