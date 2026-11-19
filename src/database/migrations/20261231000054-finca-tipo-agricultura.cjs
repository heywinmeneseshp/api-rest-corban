'use strict';

// Fincas: ORGANICA | CONVENCIONAL. A una finca orgánica no se le puede programar una mezcla convencional.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('fincas');
    if (!cols.tipo_agricultura) await queryInterface.addColumn('fincas', 'tipo_agricultura', { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'CONVENCIONAL' });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('fincas');
    if (cols.tipo_agricultura) await queryInterface.removeColumn('fincas', 'tipo_agricultura');
  },
};
