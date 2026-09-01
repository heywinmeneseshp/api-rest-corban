'use strict';

// almacenes.nombre y mezclas.nombre/codigo no tenían UNIQUE a nivel de base
// (a diferencia de producto_categorias.nombre, unidades_medida.codigo y
// productos.nombre, que sí lo tienen) — el chequeo de duplicado vivía SOLO
// en la capa de aplicación, sin respaldo real si dos requests concurrentes
// pasaban el chequeo casi al mismo tiempo. Este módulo nunca se desplegó
// (no hay datos reales todavía), así que no hace falta verificar huérfanos
// antes de agregar el constraint.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('almacenes', {
      fields: ['nombre'],
      type: 'unique',
      name: 'uniq_almacenes_nombre',
    });
    await queryInterface.addConstraint('mezclas', {
      fields: ['nombre'],
      type: 'unique',
      name: 'uniq_mezclas_nombre',
    });
    // `codigo` es nullable — MySQL permite múltiples NULL en un índice
    // único (no cuentan como duplicados entre sí), así que esto no molesta
    // a las mezclas que todavía no tienen código asignado.
    await queryInterface.addConstraint('mezclas', {
      fields: ['codigo'],
      type: 'unique',
      name: 'uniq_mezclas_codigo',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('mezclas', 'uniq_mezclas_codigo');
    await queryInterface.removeConstraint('mezclas', 'uniq_mezclas_nombre');
    await queryInterface.removeConstraint('almacenes', 'uniq_almacenes_nombre');
  },
};
