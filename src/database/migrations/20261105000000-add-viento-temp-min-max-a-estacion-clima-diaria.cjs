'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pedido explícito: la tabla "Histórico diario" de Estación
    // Meteorológica necesita viento, viento máximo, temperatura máxima y
    // temperatura mínima — hasta ahora solo se guardaba el promedio de
    // temperatura (ver estacionMeteorologica.service.js#sincronizarFecha).
    // Se agrega solo lo que falte (describeTable): en algunas BD de
    // desarrollo una de estas columnas ya existe por fuera de migraciones
    // y re-agregarla tumba la cadena con "Duplicate column name".
    const existentes = await queryInterface.describeTable('estacion_clima_diaria');
    const columnas = {
      temperatura_maxima: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      temperatura_minima: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      // Promedio del día, igual criterio que temperatura/humedad_relativa —
      // ya convertido a km/h (la API entrega mph).
      viento_velocidad: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      viento_max: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
    };
    for (const [nombre, definicion] of Object.entries(columnas)) {
      if (!existentes[nombre]) await queryInterface.addColumn('estacion_clima_diaria', nombre, definicion);
    }
  },

  async down(queryInterface) {
    const existentes = await queryInterface.describeTable('estacion_clima_diaria');
    for (const nombre of ['temperatura_maxima', 'temperatura_minima', 'viento_velocidad', 'viento_max']) {
      if (existentes[nombre]) await queryInterface.removeColumn('estacion_clima_diaria', nombre);
    }
  },
};
