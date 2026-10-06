'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Punto de la malla del modelo del que salió el dato (Open-Meteo devuelve
    // el valor de la celda más cercana a la finca, no del punto exacto): sirve
    // para agrupar las fincas que comparten el mismo dato.
    await queryInterface.addColumn('open_meteo_clima_diaria', 'celda_latitud', { type: Sequelize.DECIMAL(9, 6), allowNull: true });
    await queryInterface.addColumn('open_meteo_clima_diaria', 'celda_longitud', { type: Sequelize.DECIMAL(9, 6), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('open_meteo_clima_diaria', 'celda_longitud');
    await queryInterface.removeColumn('open_meteo_clima_diaria', 'celda_latitud');
  },
};
