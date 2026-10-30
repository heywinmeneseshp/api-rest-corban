'use strict';

// Área de fumigación del lote (Ha): la que realmente se asperja; no puede pasar del área bruta (`area`). La finca suma la de sus
// lotes activos y Programación de Aspersiones la propone como hectáreas a asperjar.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lotes', 'area_fumigacion', { type: Sequelize.DECIMAL(10, 2), allowNull: true, after: 'area' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('lotes', 'area_fumigacion');
  },
};
