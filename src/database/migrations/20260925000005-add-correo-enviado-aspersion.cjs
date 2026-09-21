'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Marca cuándo se envió por última vez el aviso por correo — el
    // frontend lo usa para (a) pintar el ícono de correo en verde cuando ya
    // se envió y (b) ocultar "Eliminar" en una aspersión cuyo aviso ya
    // salió (para no eliminar algo que la finca ya recibió).
    await queryInterface.addColumn('aspersion_programaciones', 'correo_enviado_en', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aspersion_programaciones', 'correo_enviado_en');
  },
};
