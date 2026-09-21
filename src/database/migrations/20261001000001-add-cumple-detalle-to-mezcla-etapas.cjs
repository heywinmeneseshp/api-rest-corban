'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Detalle de qué condición falló en 'resultado' — el pH se puede
    // corregir con el Regulador de pH, pero la CE no tiene forma de
    // corregirse en esta prueba. El frontend usa esto para bloquear
    // "Corrección de pH" (y forzar a finalizar) cuando la CE es la que no
    // cumple, en vez de solo mirar 'resultado' (CUMPLE/NO_CUMPLE) que no
    // distingue cuál de las dos falló.
    await queryInterface.addColumn('mezcla_etapas', 'cumple_ph', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('mezcla_etapas', 'cumple_ce', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_etapas', 'cumple_ce');
    await queryInterface.removeColumn('mezcla_etapas', 'cumple_ph');
  },
};
