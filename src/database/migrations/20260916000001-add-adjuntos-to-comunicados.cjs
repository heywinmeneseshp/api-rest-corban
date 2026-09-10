'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Metadata de los adjuntos mandados (nombre, tamaño, tipo) — NO el
    // contenido binario, ese nunca se guarda en la base, solo pasa en
    // memoria al enviar el correo (mismo criterio que uploadFotosLabor/
    // uploadPdfLabor).
    await queryInterface.addColumn('comunicados', 'adjuntos', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('comunicados', 'adjuntos');
  },
};
