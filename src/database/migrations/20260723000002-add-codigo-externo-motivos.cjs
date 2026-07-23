'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('motivos_repique', 'codigo_externo', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('motivos_recuse', 'codigo_externo', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('motivos_repique', 'codigo_externo');
    await queryInterface.removeColumn('motivos_recuse', 'codigo_externo');
  },
};
