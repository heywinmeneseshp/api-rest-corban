'use strict';

const CLAVE_MEZCLA_PARAMETROS = 'inventario_mezcla_parametros';
const DEFAULT = { phMinimo: 4, phMaximo: 6, ceMaxima: 4 };

// Backfill de cumple_ph/cumple_ce (migración 20261001000001) para etapas
// creadas ANTES de ese cambio — quedaron en NULL, y el frontend las trata
// como "no se sabe cuál falló" (no bloquea Corrección de pH aunque sea la
// CE la que no cumple). Se recalculan con los parámetros VIGENTES —no hay
// forma de saber los que regían en el momento exacto de cada etapa vieja,
// pero es la mejor aproximación disponible (mismo criterio que ya usa
// `resultado`, que tampoco se recalcula después salvo acá, por única vez).
module.exports = {
  async up(queryInterface) {
    const [config] = await queryInterface.sequelize.query(
      `SELECT valor FROM configuraciones WHERE clave = '${CLAVE_MEZCLA_PARAMETROS}' LIMIT 1`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    let parametros = DEFAULT;
    if (config?.valor) {
      try {
        parametros = { ...DEFAULT, ...JSON.parse(config.valor) };
      } catch {
        parametros = DEFAULT;
      }
    }

    const etapas = await queryInterface.sequelize.query(
      'SELECT id, ph, ce FROM mezcla_etapas WHERE cumple_ph IS NULL OR cumple_ce IS NULL',
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    for (const et of etapas) {
      const cumplePh = Number(et.ph) >= Number(parametros.phMinimo) && Number(et.ph) <= Number(parametros.phMaximo);
      const cumpleCe = Number(et.ce) < Number(parametros.ceMaxima);
      await queryInterface.sequelize.query('UPDATE mezcla_etapas SET cumple_ph = :cumplePh, cumple_ce = :cumpleCe WHERE id = :id', {
        replacements: { cumplePh, cumpleCe, id: et.id },
      });
    }
  },

  async down() {
    // No reversible con seguridad (no vuelve a NULL algo que ya se usó).
  },
};
