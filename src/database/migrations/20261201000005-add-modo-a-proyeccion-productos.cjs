'use strict';

// Reparto por producto con tres modos: PORCENTAJE (% de los kilos), CONTENEDORES (N contenedores por semana de ese producto) y
// RESTO (recibe lo que sobra). El porcentaje pasa a ser opcional (solo aplica al modo PORCENTAJE).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('proyeccion_productos', 'porcentaje', { type: Sequelize.DECIMAL(5, 2), allowNull: true });
    await queryInterface.addColumn('proyeccion_productos', 'modo', { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'PORCENTAJE', after: 'producto_id' });
    await queryInterface.addColumn('proyeccion_productos', 'contenedores', { type: Sequelize.DECIMAL(8, 2), allowNull: true, after: 'porcentaje' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('proyeccion_productos', 'contenedores');
    await queryInterface.removeColumn('proyeccion_productos', 'modo');
    await queryInterface.changeColumn('proyeccion_productos', 'porcentaje', { type: Sequelize.DECIMAL(5, 2), allowNull: false });
  },
};
