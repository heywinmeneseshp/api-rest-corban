'use strict';

const crypto = require('node:crypto');

// Estaciones meteorológicas (WeatherLink) administrables desde la web: cada una con sus credenciales (cifradas) y las fincas que usan sus datos de
// temperatura y humedad. Las dos que ya existían quedan con los mismos números (1 = Pantoja 01 Norte, 2 = San Francisco Consola) porque
// `estacion_clima_diaria.estacion` ya los usa; sin credenciales en la base se siguen leyendo de las variables de entorno.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existentes = await queryInterface.showAllTables();
    const nombres = existentes.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!nombres.includes('estaciones_meteorologicas')) {
      await queryInterface.createTable('estaciones_meteorologicas', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
        nombre: { type: Sequelize.STRING(120), allowNull: false },
        api_key: { type: Sequelize.TEXT, allowNull: true },
        api_secret: { type: Sequelize.TEXT, allowNull: true },
        station_id: { type: Sequelize.STRING(60), allowNull: true },
        estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      const ahora = new Date();
      await queryInterface.bulkInsert('estaciones_meteorologicas', [
        { id: 1, uuid: crypto.randomUUID(), nombre: 'Pantoja 01 Norte', estado: true, created_at: ahora, updated_at: ahora },
        { id: 2, uuid: crypto.randomUUID(), nombre: 'San Francisco Consola', estado: true, created_at: ahora, updated_at: ahora },
      ]);
    }
    if (!nombres.includes('estacion_meteorologica_fincas')) {
      await queryInterface.createTable('estacion_meteorologica_fincas', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        estacion_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'estaciones_meteorologicas', key: 'id' }, onDelete: 'CASCADE' },
        // Una finca usa una sola estación para sus gráficas de clima.
        finca_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: 'fincas', key: 'id' }, onDelete: 'CASCADE' },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      // Mismas fincas que hasta ahora (regex sobre el nombre): San Francisco → estación 2, Pantoja → estación 1.
      const fincas = await queryInterface.sequelize.query('SELECT id, nombre FROM fincas WHERE deleted_at IS NULL', { type: queryInterface.sequelize.QueryTypes.SELECT });
      const ahora = new Date();
      const filas = [];
      for (const f of fincas) {
        const estacion = /san\s+francisco/i.test(f.nombre) ? 2 : /pantoja/i.test(f.nombre) ? 1 : null;
        if (estacion) filas.push({ estacion_id: estacion, finca_id: f.id, created_at: ahora, updated_at: ahora });
      }
      if (filas.length) await queryInterface.bulkInsert('estacion_meteorologica_fincas', filas);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estacion_meteorologica_fincas');
    await queryInterface.dropTable('estaciones_meteorologicas');
  },
};
