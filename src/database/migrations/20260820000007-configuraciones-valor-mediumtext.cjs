'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // El logo de la marca se guarda como data URL base64 en `valor` — TEXT
    // (64KB) se queda corto para una imagen; MEDIUMTEXT permite hasta 16MB.
    await queryInterface.changeColumn('configuraciones', 'valor', {
      type: Sequelize.TEXT('medium'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('configuraciones', 'valor', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
