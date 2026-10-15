'use strict';

// Frecuencia de los contenedores fijos de un producto: cada N semanas (1 = todas, 2 = una sí y otra no) empezando en la semana
// `desde_semana` del año.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('proyeccion_productos', 'cada_semanas', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1, after: 'cajas_contenedor' });
    await queryInterface.addColumn('proyeccion_productos', 'desde_semana', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1, after: 'cada_semanas' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('proyeccion_productos', 'desde_semana');
    await queryInterface.removeColumn('proyeccion_productos', 'cada_semanas');
  },
};
