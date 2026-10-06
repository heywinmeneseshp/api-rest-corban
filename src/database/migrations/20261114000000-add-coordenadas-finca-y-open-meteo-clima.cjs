'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Coordenadas de la finca (Maestros > Fincas): las usa Open-Meteo para
    // consultar el clima de cada finca.
    await queryInterface.addColumn('fincas', 'latitud', { type: Sequelize.DECIMAL(9, 6), allowNull: true });
    await queryInterface.addColumn('fincas', 'longitud', { type: Sequelize.DECIMAL(9, 6), allowNull: true });

    // Histórico diario por finca traído de Open-Meteo.
    await queryInterface.createTable('open_meteo_clima_diaria', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      finca_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fincas', key: 'id' } },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      mm: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      temperatura: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      temperatura_maxima: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      temperatura_minima: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      humedad_relativa: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      viento_velocidad: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      viento_max: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      radiacion: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      et0: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('open_meteo_clima_diaria', ['finca_id', 'fecha'], {
      unique: true,
      name: 'uq_open_meteo_finca_fecha',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('open_meteo_clima_diaria');
    await queryInterface.removeColumn('fincas', 'longitud');
    await queryInterface.removeColumn('fincas', 'latitud');
  },
};
