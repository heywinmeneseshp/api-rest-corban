'use strict';

// Renombra en el lugar los codigo ya sembrados en `permisos` (no borra/crea
// filas, así que cualquier asignación de rol existente se preserva).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE permisos SET codigo = REPLACE(codigo, 'inventario.productos', 'inventario.articulos')
       WHERE codigo LIKE 'inventario.productos%'`,
    );
    await queryInterface.sequelize.query(
      `UPDATE permisos SET codigo = 'menu.inventarios.articulos' WHERE codigo = 'menu.inventarios.productos'`,
    );
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE permisos SET codigo = REPLACE(codigo, 'inventario.articulos', 'inventario.productos')
       WHERE codigo LIKE 'inventario.articulos%'`,
    );
    await queryInterface.sequelize.query(
      `UPDATE permisos SET codigo = 'menu.inventarios.productos' WHERE codigo = 'menu.inventarios.articulos'`,
    );
  },
};
