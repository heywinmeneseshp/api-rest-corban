'use strict';

// Fincas de precipitación diaria de un colaborador (Sanidad Vegetal → Colaboradores): en la app móvil, el usuario vinculado a
// ese colaborador ve y aprueba la precipitación diaria solo de estas fincas. Lista de ids de finca (JSON); vacía o nula =
// todas. Independiente de las fincas asignadas al usuario en Maestros → Usuarios.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('colaboradores');
    if (cols.fincas_precipitacion) return;
    await queryInterface.addColumn('colaboradores', 'fincas_precipitacion', { type: Sequelize.JSON, allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('colaboradores');
    if (cols.fincas_precipitacion) await queryInterface.removeColumn('colaboradores', 'fincas_precipitacion');
  },
};
