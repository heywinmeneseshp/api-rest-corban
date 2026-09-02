'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Añadir columna semana_registro_id (FK a semanas)
    await queryInterface.addColumn('estimaciones_finca', 'semana_registro_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'semanas', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    // 2) Backfill para filas existentes: inferir semana_registro a partir de created_at
    //    (fecha de creación mapeada al calendario de semanas). Si no hay
    //    calendario para esa fecha, se usa la propia semana_id como fallback.
    const [semanas] = await queryInterface.sequelize.query(
      'SELECT id, codigo, fecha_inicio, fecha_fin FROM semanas ORDER BY fecha_inicio ASC;',
    );
    const [filas] = await queryInterface.sequelize.query(
      'SELECT id, semana_id, created_at FROM estimaciones_finca;',
    );

    function semanaPorFecha(dateOnly) {
      for (const s of semanas) {
        if (s.fecha_inicio <= dateOnly && dateOnly <= s.fecha_fin) return s;
      }
      let cand = null;
      for (const s of semanas) {
        if (s.fecha_inicio <= dateOnly) cand = s;
        else break;
      }
      return cand;
    }

    for (const f of filas) {
      const dateOnly = new Date(f.created_at).toISOString().slice(0, 10);
      const src = semanaPorFecha(dateOnly);
      const registroId = src ? src.id : f.semana_id;
      await queryInterface.sequelize.query(
        'UPDATE estimaciones_finca SET semana_registro_id = :registroId WHERE id = :id;',
        { replacements: { registroId, id: f.id } },
      );
    }

    // 3) Hacer la columna NOT NULL (ahora ya está poblada)
    await queryInterface.changeColumn('estimaciones_finca', 'semana_registro_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'semanas', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    // 4) Reemplazar índice único: antes (semana_id, finca_id, created_by) → ahora incluye semana_registro_id
    try {
      await queryInterface.removeConstraint('estimaciones_finca', 'uq_est_semana_finca_usuario');
    } catch {
      // por si el nombre difiere según el dialecto, intentar remover índice
      try {
        await queryInterface.removeIndex('estimaciones_finca', 'uq_est_semana_finca_usuario');
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

  async down(queryInterface) {
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
      fields: ['semana_id', 'finca_id', 'created_by'],
      type: 'unique',
      name: 'uq_est_semana_finca_usuario',
    });
    await queryInterface.removeColumn('estimaciones_finca', 'semana_registro_id');
  },
};
