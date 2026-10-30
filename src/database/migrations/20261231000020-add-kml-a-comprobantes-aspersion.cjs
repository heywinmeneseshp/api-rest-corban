'use strict';

// Recorrido de la aplicación (archivo KML) del comprobante de aspersión: se sube en borrador y su mapa sale en la segunda hoja
// del PDF. `kml`: el archivo original (se puede descargar); `kml_geometria`: el recorrido simplificado (líneas, polígonos y puntos
// en [lat, lng]) que usan el mapa y el PDF, para no cargar el archivo completo en cada consulta.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('comprobantes_aspersion', 'kml', { type: Sequelize.TEXT('medium'), allowNull: true });
    await queryInterface.addColumn('comprobantes_aspersion', 'kml_nombre', { type: Sequelize.STRING(200), allowNull: true });
    await queryInterface.addColumn('comprobantes_aspersion', 'kml_geometria', { type: Sequelize.JSON, allowNull: true });
    await queryInterface.addColumn('comprobantes_aspersion', 'kml_subido_en', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    for (const col of ['kml_subido_en', 'kml_geometria', 'kml_nombre', 'kml']) {
      await queryInterface.removeColumn('comprobantes_aspersion', col);
    }
  },
};
