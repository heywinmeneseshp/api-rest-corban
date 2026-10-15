'use strict';

// Orden en que se muestran los productos (columnas de la tabla por producto), definido por el usuario.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('proyeccion_productos', 'orden', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0, after: 'desde_semana' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('proyeccion_productos', 'orden');
  },
};
