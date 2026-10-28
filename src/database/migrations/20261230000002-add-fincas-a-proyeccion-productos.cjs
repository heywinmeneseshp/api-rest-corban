'use strict';

// Modo FINCA del reparto por producto: el producto se queda con la fruta de estas fincas (uuids), en contenedores completos.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('proyeccion_productos', 'fincas', { type: Sequelize.JSON, allowNull: true, after: 'desde_semana' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('proyeccion_productos', 'fincas');
  },
};
