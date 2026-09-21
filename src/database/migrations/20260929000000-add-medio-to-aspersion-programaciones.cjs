'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Con qué se hace la aspersión — selección única, no las dos a la vez
    // (pedido explícito). Nullable: las aspersiones ya programadas antes de
    // este campo quedan sin dato, no se les asigna uno arbitrario.
    await queryInterface.addColumn('aspersion_programaciones', 'medio', {
      type: Sequelize.ENUM('AVION', 'DRON'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aspersion_programaciones', 'medio');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_aspersion_programaciones_medio";').catch(() => {});
  },
};
