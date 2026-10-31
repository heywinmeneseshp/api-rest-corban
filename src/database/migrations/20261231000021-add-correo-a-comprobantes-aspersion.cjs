'use strict';

// Envío del comprobante de aspersión por correo (después de aprobarlo/emitirlo): cuándo y quién lo envió.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('comprobantes_aspersion', 'correo_enviado_en', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('comprobantes_aspersion', 'correo_enviado_por_id', { type: Sequelize.INTEGER, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('comprobantes_aspersion', 'correo_enviado_por_id');
    await queryInterface.removeColumn('comprobantes_aspersion', 'correo_enviado_en');
  },
};
