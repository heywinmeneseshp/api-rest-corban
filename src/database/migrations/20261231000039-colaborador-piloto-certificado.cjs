'use strict';

// Colaboradores: si está certificado como piloto de dron (los pilotos deben contar con la certificación).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('colaboradores');
    if (!cols.piloto_certificado) await queryInterface.addColumn('colaboradores', 'piloto_certificado', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('colaboradores');
    if (cols.piloto_certificado) await queryInterface.removeColumn('colaboradores', 'piloto_certificado');
  },
};
