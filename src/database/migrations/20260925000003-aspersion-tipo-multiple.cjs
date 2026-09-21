'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // El aviso en papel permite marcar varios tipos a la vez (Sigatoka
    // Negra + Defoliador, por ejemplo) — pasa de ENUM (uno solo) a JSON
    // (array de valores). Los registros existentes se envuelven en un
    // array de un elemento para no perder el dato ya guardado. No se puede
    // ir directo de ENUM a JSON: un ENUM solo acepta sus valores literales,
    // así que primero se relaja a VARCHAR, se reescribe el dato y recién
    // ahí se pasa a JSON.
    await queryInterface.changeColumn('aspersion_programaciones', 'tipo', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });
    await queryInterface.sequelize.query(
      "UPDATE aspersion_programaciones SET tipo = CONCAT('[\"', tipo, '\"]')",
    );
    await queryInterface.changeColumn('aspersion_programaciones', 'tipo', {
      type: Sequelize.JSON,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE aspersion_programaciones SET tipo = JSON_UNQUOTE(JSON_EXTRACT(tipo, '$[0]'))",
    );
    await queryInterface.changeColumn('aspersion_programaciones', 'tipo', {
      type: Sequelize.ENUM('SIGATOKA_NEGRA', 'DEFOLIADOR', 'FERTILIZACION'),
      allowNull: false,
      defaultValue: 'SIGATOKA_NEGRA',
    });
  },
};
