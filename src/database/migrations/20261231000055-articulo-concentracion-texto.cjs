'use strict';

// Concentración del insumo como texto libre (p. ej. «880 g/L», «250 g/kg»). Los valores numéricos que ya había quedan como
// texto sin decimales sobrantes (880.00 -> 880).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('articulos');
    if (!cols.concentracion_ia) return;
    if (/char|text/i.test(cols.concentracion_ia.type)) return;
    await queryInterface.changeColumn('articulos', 'concentracion_ia', { type: Sequelize.STRING(100), allowNull: true });
    await queryInterface.sequelize.query(
      "UPDATE articulos SET concentracion_ia = TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM concentracion_ia)) WHERE concentracion_ia LIKE '%.%'",
    );
  },
  async down() {},
};
