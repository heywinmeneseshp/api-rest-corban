'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('fincas', 'perimetro', {
      type: Sequelize.JSON,
      allowNull: true,
      comment:
        'Perímetro de la finca para dibujar en el mapa — array de pares [lat, lng] (ej. importado desde un .kml de Google Earth). Null = sin perímetro cargado.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('fincas', 'perimetro');
  },
};
