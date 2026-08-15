'use strict';

// Backfill: todo rol que ya tenga acceso al submenú Evaluaciones de Sanidad
// Vegetal (menu.sanidad_vegetal.evaluaciones) recibe también el nuevo
// submenú Alertas — mismo criterio que el backfill original de la capa
// menu.* (20260812110118), evitando que un rol existente deje de ver algo
// que hoy ya podía usar.
module.exports = {
  async up(queryInterface) {
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const permisos = await queryInterface.sequelize.query(
      "SELECT id, codigo FROM permisos WHERE codigo IN ('menu.sanidad_vegetal.evaluaciones', 'menu.sanidad_vegetal.alertas')",
      { type: QueryTypes.SELECT },
    );
    const idTrigger = permisos.find((p) => p.codigo === 'menu.sanidad_vegetal.evaluaciones')?.id;
    const idNuevo = permisos.find((p) => p.codigo === 'menu.sanidad_vegetal.alertas')?.id;
    if (!idTrigger || !idNuevo) return;

    const rolesConTrigger = await queryInterface.sequelize.query(
      'SELECT DISTINCT role_id FROM rol_permisos WHERE permiso_id = :idTrigger',
      { replacements: { idTrigger }, type: QueryTypes.SELECT },
    );
    if (rolesConTrigger.length === 0) return;

    const rolesConNuevo = await queryInterface.sequelize.query(
      'SELECT role_id FROM rol_permisos WHERE permiso_id = :idNuevo',
      { replacements: { idNuevo }, type: QueryTypes.SELECT },
    );
    const yaTienen = new Set(rolesConNuevo.map((r) => r.role_id));

    const filasNuevas = rolesConTrigger
      .filter((r) => !yaTienen.has(r.role_id))
      .map((r) => ({ role_id: r.role_id, permiso_id: idNuevo, created_at: now }));

    if (filasNuevas.length > 0) {
      await queryInterface.bulkInsert('rol_permisos', filasNuevas);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('SELECT 1');
  },
};
