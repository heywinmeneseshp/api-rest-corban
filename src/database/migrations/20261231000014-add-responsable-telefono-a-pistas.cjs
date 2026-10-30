'use strict';

// Responsable (representante) y teléfono de la pista: el responsable firma el aviso de aspersión de la pista.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pistas', 'responsable', { type: Sequelize.STRING(150), allowNull: true, after: 'nombre' });
    await queryInterface.addColumn('pistas', 'telefono', { type: Sequelize.STRING(40), allowNull: true, after: 'responsable' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pistas', 'telefono');
    await queryInterface.removeColumn('pistas', 'responsable');
  },
};
