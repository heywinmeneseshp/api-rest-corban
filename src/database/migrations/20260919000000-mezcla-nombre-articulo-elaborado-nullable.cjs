'use strict';

// El operador de laboratorio ahora puede crear una prueba solo con el
// almacén de origen — el código lo genera el sistema (correlativo, ver
// mezcla.service.js#create) y el nombre + el artículo elaborado (producto
// objetivo) se asignan más adelante, antes de finalizar la prueba (ver
// mezcla.service.js#finalizar, que sí los exige). Antes ambos eran
// NOT NULL, lo que obligaba a digitarlos de entrada.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('mezclas', 'nombre', { type: Sequelize.STRING(150), allowNull: true });
    // Sin `references` acá a propósito: la FK ya existe en la columna
    // (creada en 20260901000004) y volver a declararla en un changeColumn
    // sobre MySQL no aplica el cambio de nulabilidad de forma confiable —
    // confirmado en vivo contra la BD de dev, el ALTER con `references`
    // no tocaba `Null: NO`. Un MODIFY COLUMN plano sí lo hace y la FK
    // existente no se toca.
    await queryInterface.changeColumn('mezclas', 'articulo_elaborado_id', { type: Sequelize.INTEGER, allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('mezclas', 'nombre', { type: Sequelize.STRING(150), allowNull: false });
    await queryInterface.changeColumn('mezclas', 'articulo_elaborado_id', { type: Sequelize.INTEGER, allowNull: false });
  },
};
