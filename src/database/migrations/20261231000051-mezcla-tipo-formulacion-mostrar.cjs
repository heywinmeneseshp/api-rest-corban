'use strict';

// Mezclas: tipo (ORGANICA | CONVENCIONAL) y formulación (EMULSION | SOLUCION | SUSPENSION, va en el nombre automático); el nombre
// pasa a 255 caracteres (el automático incluye insumos e ingredientes activos). Componentes: mostrar o no el insumo
// (principal o secundario) en el comprobante de aspersión.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const m = await queryInterface.describeTable('mezclas');
    if (!m.tipo_agricultura) await queryInterface.addColumn('mezclas', 'tipo_agricultura', { type: Sequelize.STRING(15), allowNull: true });
    if (!m.formulacion) await queryInterface.addColumn('mezclas', 'formulacion', { type: Sequelize.STRING(15), allowNull: true });
    await queryInterface.changeColumn('mezclas', 'nombre', { type: Sequelize.STRING(255), allowNull: true });
    const c = await queryInterface.describeTable('mezcla_componentes');
    if (!c.mostrar_comprobante) await queryInterface.addColumn('mezcla_componentes', 'mostrar_comprobante', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
  },
  async down(queryInterface) {
    const m = await queryInterface.describeTable('mezclas');
    if (m.tipo_agricultura) await queryInterface.removeColumn('mezclas', 'tipo_agricultura');
    if (m.formulacion) await queryInterface.removeColumn('mezclas', 'formulacion');
    const c = await queryInterface.describeTable('mezcla_componentes');
    if (c.mostrar_comprobante) await queryInterface.removeColumn('mezcla_componentes', 'mostrar_comprobante');
  },
};
