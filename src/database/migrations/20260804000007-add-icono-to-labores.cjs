'use strict';

// La migración de `labores` ya estaba marcada como ejecutada cuando se le
// agregó la columna `icono` (fase de rediseño del Calendario de Labores),
// así que ese cambio nunca llegó a la base real. Se agrega aquí como
// migración incremental.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('labores', 'icono', {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: 'FiClipboard',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('labores', 'icono');
  },
};
