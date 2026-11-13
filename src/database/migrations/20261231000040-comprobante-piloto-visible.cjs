'use strict';

// Comprobantes de aspersión: piloto que se muestra en el PDF. Debe estar certificado: si el piloto original (el que se paga) no lo está,
// aquí se guarda otro piloto certificado para el comprobante; el original queda en piloto_colaborador_id.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('comprobantes_aspersion');
    if (!cols.piloto_visible_colaborador_id) {
      await queryInterface.addColumn('comprobantes_aspersion', 'piloto_visible_colaborador_id', { type: Sequelize.INTEGER, allowNull: true });
    }
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('comprobantes_aspersion');
    if (cols.piloto_visible_colaborador_id) await queryInterface.removeColumn('comprobantes_aspersion', 'piloto_visible_colaborador_id');
  },
};
