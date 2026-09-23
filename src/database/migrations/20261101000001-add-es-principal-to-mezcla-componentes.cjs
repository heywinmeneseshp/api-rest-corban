'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marca el insumo "principal" de la receta — selección única por
    // versión (nunca más de uno en true a la vez, ver
    // mezcla.service.js#marcarComponentePrincipal). Por ahora es solo un
    // dato guardado; la lógica que lo use se define más adelante.
    await queryInterface.addColumn('mezcla_componentes', 'es_principal', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_componentes', 'es_principal');
  },
};
