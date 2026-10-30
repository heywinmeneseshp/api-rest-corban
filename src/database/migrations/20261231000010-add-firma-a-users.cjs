'use strict';

// Firma del usuario (imagen PNG) para firmar documentos: el archivo vive en Google Drive (GOOGLE_DRIVE_FOLDER /
// Firmas_Usuarios); aquí solo se guarda su id y cuándo se subió.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'firma_drive_id', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.addColumn('users', 'firma_actualizada_en', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'firma_actualizada_en');
    await queryInterface.removeColumn('users', 'firma_drive_id');
  },
};
