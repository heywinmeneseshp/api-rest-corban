'use strict';

// Reglas de secuencia del FRAC Banana Working Group (Sigatoka negra), tal cual las publica por grupo:
//  - max_consecutivas: máximo de aplicaciones seguidas del grupo (1 = alternancia total / "sin aplicaciones consecutivas";
//    2 = bloques de máximo 2 en las aminas).
//  - intervalo_minimo_dias: tiempo mínimo "libre" del grupo entre aplicaciones (3 meses = 90 días, 6 semanas = 42 días).
//  - solo_en_mezclas: el grupo solo se usa en mezcla con otro modo de acción.
// Multisitios (M) y biológicos (BM02): sin reglas de secuencia.
const REGLAS = [
  // [codigo, max_consecutivas, intervalo_minimo_dias, solo_en_mezclas]
  ['3', 1, null, 1],
  ['5', 2, null, 0],
  ['9', 1, null, 1],
  ['11', 1, 90, 1],
  ['21', 1, null, 1],
  ['1', 1, 90, 1],
  ['7', 1, 90, 1],
  ['U12', 1, 42, 1],
  ['10', 1, 90, 1],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('frac_codigos', 'max_consecutivas', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('frac_codigos', 'intervalo_minimo_dias', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('frac_codigos', 'solo_en_mezclas', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    for (const [codigo, consecutivas, intervalo, soloMezclas] of REGLAS) {
      await queryInterface.sequelize.query(
        'UPDATE frac_codigos SET max_consecutivas = :consecutivas, intervalo_minimo_dias = :intervalo, solo_en_mezclas = :soloMezclas WHERE codigo = :codigo',
        { replacements: { codigo, consecutivas, intervalo, soloMezclas } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('frac_codigos', 'max_consecutivas');
    await queryInterface.removeColumn('frac_codigos', 'intervalo_minimo_dias');
    await queryInterface.removeColumn('frac_codigos', 'solo_en_mezclas');
  },
};
