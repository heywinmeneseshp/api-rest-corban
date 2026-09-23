'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // El índice único incluía created_by, así que dos usuarios distintos
    // guardando la MISMA finca+semana en la MISMA semana de registro
    // quedaban como dos filas separadas en vez de una reemplazar a la
    // otra — y como las vistas agregadas (pivote, escalera, comparativo)
    // SUMan por finca+semana sin filtrar por usuario, el resultado
    // mostrado era la suma de ambos usuarios en vez del más reciente
    // (bug real reportado). Antes de poder quitar created_by de la clave
    // única hay que fusionar los duplicados que ya existan: por cada
    // grupo finca+semana+semana_registro con más de una fila, se conserva
    // la más reciente (mayor updated_at) y se eliminan (hard delete,
    // incluidas las ya soft-deleted) las demás.
    const [duplicados] = await queryInterface.sequelize.query(`
      SELECT semana_id, finca_id, semana_registro_id
      FROM estimaciones_finca
      GROUP BY semana_id, finca_id, semana_registro_id
      HAVING COUNT(*) > 1;
    `);

    for (const d of duplicados) {
      const [filas] = await queryInterface.sequelize.query(
        `SELECT id FROM estimaciones_finca
         WHERE semana_id = :semanaId AND finca_id = :fincaId AND semana_registro_id = :semanaRegistroId
         ORDER BY updated_at DESC, id DESC;`,
        { replacements: { semanaId: d.semana_id, fincaId: d.finca_id, semanaRegistroId: d.semana_registro_id } },
      );
      const idsABorrar = filas.slice(1).map((f) => f.id);
      if (idsABorrar.length > 0) {
        await queryInterface.sequelize.query('DELETE FROM estimaciones_finca WHERE id IN (:ids);', {
          replacements: { ids: idsABorrar },
        });
      }
    }

    try {
      await queryInterface.removeConstraint('estimaciones_finca', 'uq_est_semana_finca_usuario_registro');
    } catch {
      try {
        await queryInterface.removeIndex('estimaciones_finca', 'uq_est_semana_finca_usuario_registro');
      } catch {
        // el índice ya no existe bajo ningún nombre conocido — nada que hacer.
      }
    }
    await queryInterface.addConstraint('estimaciones_finca', {
      fields: ['semana_id', 'finca_id', 'semana_registro_id'],
      type: 'unique',
      name: 'uq_est_semana_finca_registro',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeConstraint('estimaciones_finca', 'uq_est_semana_finca_registro');
    } catch {
      try {
        await queryInterface.removeIndex('estimaciones_finca', 'uq_est_semana_finca_registro');
      } catch {
        // el índice ya no existe bajo ningún nombre conocido — nada que hacer.
      }
    }
    await queryInterface.addConstraint('estimaciones_finca', {
      fields: ['semana_id', 'finca_id', 'created_by', 'semana_registro_id'],
      type: 'unique',
      name: 'uq_est_semana_finca_usuario_registro',
    });
  },
};
