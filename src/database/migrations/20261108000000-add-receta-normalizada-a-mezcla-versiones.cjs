'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marca las recetas ya "llevadas a 1 litro con dosis exactas" (ver
    // mezcla.service.js#llevarAUnLitro): se hace UNA sola vez, al abrir por
    // primera vez un borrador creado con "Nueva mezcla" — después las
    // ediciones del operador se respetan.
    await queryInterface.addColumn('mezcla_versiones', 'receta_normalizada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_versiones', 'receta_normalizada');
  },
};
