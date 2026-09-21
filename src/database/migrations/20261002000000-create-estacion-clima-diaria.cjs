'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Histórico diario de la estación meteorológica (WeatherLink) — se
    // llena solo, una fila por día, vía el cron
    // sincronizar-estacion-meteorologica (ver src/jobs y
    // estacionMeteorologica.service.js#sincronizarDiaAnterior). Pantalla
    // propia (Estación Meteorológica), NO alimenta Clima ni Precipitación
    // Diaria — es un módulo aparte, sin relación con esas tablas.
    await queryInterface.createTable('estacion_clima_diaria', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      // Suma de lluvia del día (mm) — la API ya la entrega en mm sin
      // necesidad de convertir.
      mm: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      // Promedio del día — la API entrega temperatura en °F, se convierte
      // a °C antes de guardar (ver el service).
      temperatura: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      humedad_relativa: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estacion_clima_diaria');
  },
};
