'use strict';

// Reglas de manejo de resistencia por código FRAC (FRAC Banana Working Group, Sigatoka negra).
const FUENTE = 'FRAC Banana Working Group — recomendaciones de manejo de resistencia (Sigatoka negra), frac.info/frac-teams/working-groups/banana-group';
const REGLAS = [
  ['3', 8, 50, 'Solo en mezclas con otros modos de acción; alternancia total (idealmente 2 ciclos de otros modos entre usos); iniciar al comienzo de la curva anual de la enfermedad.'],
  ['5', 15, 50, 'Solo o en mezcla (mejor en mezcla); bloques de máximo 2 aplicaciones consecutivas; se prefiere la alternancia total.'],
  ['9', 8, 50, 'Solo en mezclas; alternancia total.'],
  ['11', 3, 33, 'Solo en mezclas; en alternancia, sin aplicaciones consecutivas; al menos 3 meses sin QoI entre aplicaciones; iniciar con la enfermedad en nivel bajo.'],
  ['21', 3, 33, 'Solo en mezclas (preferible con multisitios); en alternancia, sin aplicaciones consecutivas.'],
  ['1', 3, 33, 'Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin benzimidazoles entre aplicaciones.'],
  ['7', 3, 33, 'Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin SDHI; un drench al suelo para nematodos cuenta como una aplicación SDHI.'],
  ['U12', 6, 33, 'Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 6 semanas sin guanidinas entre aplicaciones.'],
  ['10', 3, 33, 'Solo en mezclas; en alternancia, sin bloques consecutivos; al menos 3 meses sin N-fenil carbamatos entre aplicaciones.'],
];
// Multisitios (M01-M05) y biológicos (BM02): sin límite dentro de la etiqueta.
const SIN_LIMITE = [
  ['M01', 'Sin límite dentro de la etiqueta; solo o en mezcla.'],
  ['M02', 'Sin límite dentro de la etiqueta; solo o en mezcla.'],
  ['M03', 'Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.'],
  ['M04', 'Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.'],
  ['M05', 'Multisitio: sin límite dentro de la etiqueta; solo o en mezcla.'],
  ['BM02', 'Biológico: sin límite dentro de la etiqueta; solo o en mezcla.'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('frac_codigos', 'max_porcentaje_aplicaciones', { type: Sequelize.DECIMAL(5, 2), allowNull: true });
    await queryInterface.addColumn('frac_codigos', 'restricciones', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('frac_codigos', 'fuente', { type: Sequelize.STRING(255), allowNull: true });
    const q = queryInterface.sequelize;
    for (const [codigo, max, pct, texto] of REGLAS) {
      await q.query('UPDATE frac_codigos SET max_aplicaciones = :max, max_porcentaje_aplicaciones = :pct, restricciones = :texto, fuente = :fuente WHERE codigo = :codigo', {
        replacements: { codigo, max, pct, texto, fuente: FUENTE },
      });
    }
    for (const [codigo, texto] of SIN_LIMITE) {
      await q.query('UPDATE frac_codigos SET restricciones = :texto, fuente = :fuente WHERE codigo = :codigo', { replacements: { codigo, texto, fuente: FUENTE } });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('frac_codigos', 'max_porcentaje_aplicaciones');
    await queryInterface.removeColumn('frac_codigos', 'restricciones');
    await queryInterface.removeColumn('frac_codigos', 'fuente');
  },
};
