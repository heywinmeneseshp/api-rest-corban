'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('fincas', 'grupo_finca_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'grupos_finca', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('fincas', 'grupo_finca_id');
  },
};
