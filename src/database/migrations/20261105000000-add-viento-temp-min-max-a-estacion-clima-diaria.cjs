'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pedido explícito: la tabla "Histórico diario" de Estación
    // Meteorológica necesita viento, viento máximo, temperatura máxima y
    // temperatura mínima — hasta ahora solo se guardaba el promedio de
    // temperatura (ver estacionMeteorologica.service.js#sincronizarFecha).
    await queryInterface.addColumn('estacion_clima_diaria', 'temperatura_maxima', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('estacion_clima_diaria', 'temperatura_minima', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
    });
    // Promedio del día, igual criterio que temperatura/humedad_relativa —
    // ya convertido a km/h (la API entrega mph).
    await queryInterface.addColumn('estacion_clima_diaria', 'viento_velocidad', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('estacion_clima_diaria', 'viento_max', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estacion_clima_diaria', 'temperatura_maxima');
    await queryInterface.removeColumn('estacion_clima_diaria', 'temperatura_minima');
    await queryInterface.removeColumn('estacion_clima_diaria', 'viento_velocidad');
    await queryInterface.removeColumn('estacion_clima_diaria', 'viento_max');
  },
};
