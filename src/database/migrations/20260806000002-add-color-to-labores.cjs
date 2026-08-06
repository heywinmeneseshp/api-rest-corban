'use strict';

// Mismo caso que `20260804000007-add-icono-to-labores.cjs`: la migración de
// `labores` ya estaba marcada como ejecutada cuando se le agregó la columna
// `color` (fase de mover el color de categoría a labor), así que ese cambio
// nunca llegó a la base real. Se agrega aquí como migración incremental.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('labores', 'color', {
      type: Sequelize.STRING(7),
      allowNull: false,
      defaultValue: '#16a34a',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('labores', 'color');
  },
};
