'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marca las versiones creadas con mezclaService.crearDirecta() — un
    // elaborado definido directamente, SIN pasar por la prueba de
    // laboratorio (pH/CE/etapas). Sirve para excluirlas del listado
    // "Mezclas — Pruebas de laboratorio" (/inventarios/mezclas), que solo
    // debe mostrar pruebas reales.
    await queryInterface.addColumn('mezcla_versiones', 'es_directa', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_versiones', 'es_directa');
  },
};
