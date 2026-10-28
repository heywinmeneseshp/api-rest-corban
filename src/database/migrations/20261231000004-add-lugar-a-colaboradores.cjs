'use strict';

// Lugar predeterminado del colaborador: una finca (finca_id) o un lugar de asistencia como una oficina (lugar_id), nunca ambos.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'lugar_id', { type: Sequelize.INTEGER, allowNull: true, after: 'finca_id' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colaboradores', 'lugar_id');
  },
};
