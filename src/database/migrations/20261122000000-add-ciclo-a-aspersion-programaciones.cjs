'use strict';

// Ciclo de aspersión: una misma APLICACIÓN puede hacerse en varios días (ejecución parcial o dos
// aspersiones programadas que en realidad son el mismo ciclo). Cada día es una aspersión (parte n)
// y todas comparten `ciclo_uuid`. FRAC cuenta el ciclo como UNA aplicación.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = 'aspersion_programaciones';
    await queryInterface.addColumn(t, 'ciclo_uuid', { type: Sequelize.CHAR(36), allowNull: true });
    await queryInterface.addColumn(t, 'ciclo_parte', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    await queryInterface.addIndex(t, ['ciclo_uuid'], { name: 'idx_aspersion_programaciones_ciclo' });
    const q = queryInterface.sequelize;
    // Cada aspersión nace con su propio ciclo.
    await q.query(`UPDATE ${t} SET ciclo_uuid = uuid WHERE ciclo_uuid IS NULL`);

    // ÚNICA vez: se unen las ya cargadas de la misma finca y misma mezcla en días seguidos (≤ 1 día).
    const [filas] = await q.query(`SELECT id, finca_id, mezcla_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, uuid FROM ${t}
                                    WHERE deleted_at IS NULL AND estado <> 'CANCELADA' ORDER BY finca_id, mezcla_id, fecha, id`);
    const dias = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
    let prev = null;
    let cicloActual = null;
    let parte = 0;
    for (const f of filas) {
      if (prev && prev.finca_id === f.finca_id && prev.mezcla_id === f.mezcla_id && dias(prev.fecha, f.fecha) <= 1) {
        parte += 1;
        await q.query(`UPDATE ${t} SET ciclo_uuid = :ciclo, ciclo_parte = :parte WHERE id = :id`, { replacements: { ciclo: cicloActual, parte, id: f.id } });
      } else {
        cicloActual = f.uuid;
        parte = 1;
      }
      prev = f;
    }
  },

  async down(queryInterface) {
    const t = 'aspersion_programaciones';
    await queryInterface.removeIndex(t, 'idx_aspersion_programaciones_ciclo');
    await queryInterface.removeColumn(t, 'ciclo_uuid');
    await queryInterface.removeColumn(t, 'ciclo_parte');
  },
};
