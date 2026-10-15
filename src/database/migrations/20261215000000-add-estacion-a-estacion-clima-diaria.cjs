'use strict';

// Segunda estación WeatherLink: cada fila pasa a identificar su estación
// (1 = Pantoja 01 Norte, 2 = San Francisco Consola) y la unicidad de la fecha
// pasa a ser por estación.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('estacion_clima_diaria');
    if (!cols.estacion) {
      await queryInterface.addColumn('estacion_clima_diaria', 'estacion', { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1, after: 'uuid' });
    }
    const indices = await queryInterface.showIndex('estacion_clima_diaria');
    const porFecha = indices.find((i) => i.unique && i.fields.length === 1 && i.fields[0].attribute === 'fecha');
    if (porFecha) await queryInterface.removeIndex('estacion_clima_diaria', porFecha.name);
    if (!indices.some((i) => i.name === 'estacion_clima_diaria_fecha_estacion')) {
      await queryInterface.addIndex('estacion_clima_diaria', ['fecha', 'estacion'], { unique: true, name: 'estacion_clima_diaria_fecha_estacion' });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('estacion_clima_diaria', 'estacion_clima_diaria_fecha_estacion');
    await queryInterface.addIndex('estacion_clima_diaria', ['fecha'], { unique: true });
    await queryInterface.removeColumn('estacion_clima_diaria', 'estacion');
  },
};
