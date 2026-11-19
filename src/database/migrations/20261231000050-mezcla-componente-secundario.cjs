'use strict';

// Insumos SECUNDARIOS de la receta (además del principal): pueden ser varios; su información sale en el comprobante de aspersión.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('mezcla_componentes');
    if (!cols.es_secundario) await queryInterface.addColumn('mezcla_componentes', 'es_secundario', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, after: 'es_principal' });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('mezcla_componentes');
    if (cols.es_secundario) await queryInterface.removeColumn('mezcla_componentes', 'es_secundario');
  },
};
