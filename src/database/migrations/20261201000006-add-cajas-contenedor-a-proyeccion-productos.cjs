'use strict';

// Cajas por contenedor propias del escenario (opcional): reemplazan las del catálogo (cajas por palet × palets por contenedor).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('proyeccion_productos', 'cajas_contenedor', { type: Sequelize.DECIMAL(8, 2), allowNull: true, after: 'contenedores' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('proyeccion_productos', 'cajas_contenedor');
  },
};
