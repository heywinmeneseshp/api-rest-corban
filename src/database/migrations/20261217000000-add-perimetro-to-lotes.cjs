'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lotes', 'perimetro', {
      type: Sequelize.JSON,
      allowNull: true,
      comment:
        'Perímetro del lote para dibujar en el mapa — array de pares [lat, lng] (ej. importado desde un .kml/.kmz de Google Earth). Null = sin perímetro cargado.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lotes', 'perimetro');
  },
};
