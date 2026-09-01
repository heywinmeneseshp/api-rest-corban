'use strict';

// `productos.tipo` y `producto_categorias.tipo` guardaban el mismo ENUM
// (INSUMO/REPUESTO/ELABORADO/GENERAL) por separado, sin ninguna validación
// que los mantuviera sincronizados -- un producto podía tener un tipo
// distinto al de su propia categoría. No hay ninguna regla de negocio en
// el backend que lea `productos.tipo` (mezclas, elaboraciones, etc. no lo
// usan); el único consumidor era el filtro de "repuestos compatibles" de
// Equipos, que ahora filtra por `producto_categorias.tipo` en su lugar
// (ver productoInventario.repository.js). Se elimina la columna: el tipo
// de un producto pasa a ser SIEMPRE el de su categoría (join), una sola
// fuente de verdad.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    await queryInterface.removeColumn('productos', 'tipo');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('productos', 'tipo', {
      type: Sequelize.ENUM('INSUMO', 'REPUESTO', 'ELABORADO', 'GENERAL'),
      allowNull: false,
      defaultValue: 'GENERAL',
    });
  },
};
