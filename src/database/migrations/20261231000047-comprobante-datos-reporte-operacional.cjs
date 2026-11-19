'use strict';

// Datos del reporte operacional de fumigación que el comprobante no tenía: equipo de aplicación, altura de vuelo, ancho de
// deposición, concentración del ingrediente activo, persona que autoriza, tiempos de reentrada y carencia y manipuladores de
// plaguicidas ([{ nombre, documento }]).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('comprobantes_aspersion');
    const add = async (n, def) => {
      if (!cols[n]) await queryInterface.addColumn('comprobantes_aspersion', n, def);
    };
    await add('tipo_equipo', { type: Sequelize.STRING(150), allowNull: true });
    await add('altura_vuelo', { type: Sequelize.STRING(50), allowNull: true });
    await add('ancho_deposicion', { type: Sequelize.DECIMAL(6, 2), allowNull: true });
    await add('concentracion_ia', { type: Sequelize.DECIMAL(8, 2), allowNull: true });
    await add('persona_autoriza', { type: Sequelize.STRING(150), allowNull: true });
    await add('tiempo_reentrada', { type: Sequelize.DECIMAL(5, 1), allowNull: true, defaultValue: 4 });
    await add('tiempo_carencia', { type: Sequelize.DECIMAL(5, 1), allowNull: true, defaultValue: 0 });
    await add('manipuladores', { type: Sequelize.JSON, allowNull: true });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('comprobantes_aspersion');
    for (const n of ['tipo_equipo', 'altura_vuelo', 'ancho_deposicion', 'concentracion_ia', 'persona_autoriza', 'tiempo_reentrada', 'tiempo_carencia', 'manipuladores']) {
      if (cols[n]) await queryInterface.removeColumn('comprobantes_aspersion', n);
    }
  },
};
