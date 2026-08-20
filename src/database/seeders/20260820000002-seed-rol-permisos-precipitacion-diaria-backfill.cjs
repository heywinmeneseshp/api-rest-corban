'use strict';

// Backfill: los roles que ya tienen visible el ítem de menú "Precipitación
// Diaria" (menu.precipitacion_diaria) reciben el permiso de ver esa
// pantalla — sin esto, ya veían el link en el Sidebar pero el propio
// listado les devolvía 403 (el permiso no existía en la base todavía, ver
// seeder 20260820000001). "configurar" (programar captura obligatoria) NO
// se backfillea acá: es una acción más sensible (afecta tareas de otros
// usuarios), se asigna a mano desde Maestros → Roles → Permisos.
const TRIGGERS = {
  'precipitacion_diaria.ver': ['menu.precipitacion_diaria'],
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const roles = await queryInterface.sequelize.query('SELECT id FROM roles', { type: QueryTypes.SELECT });
    if (roles.length === 0) return;

    const permisos = await queryInterface.sequelize.query('SELECT id, codigo FROM permisos', { type: QueryTypes.SELECT });
    const idPorCodigo = new Map(permisos.map((p) => [p.codigo, p.id]));

    const filasNuevas = [];
    for (const rol of roles) {
      const asignados = await queryInterface.sequelize.query(
        'SELECT p.codigo FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.role_id = :roleId',
        { replacements: { roleId: rol.id }, type: QueryTypes.SELECT },
      );
      const codigosDelRol = new Set(asignados.map((a) => a.codigo));

      for (const [codigoNuevo, triggers] of Object.entries(TRIGGERS)) {
        if (codigosDelRol.has(codigoNuevo)) continue;
        const permisoIdNuevo = idPorCodigo.get(codigoNuevo);
        if (!permisoIdNuevo) continue;

        const califica = triggers.some((t) => codigosDelRol.has(t));
        if (!califica) continue;

        filasNuevas.push({ role_id: rol.id, permiso_id: permisoIdNuevo, created_at: now });
      }
    }

    if (filasNuevas.length > 0) {
      await queryInterface.bulkInsert('rol_permisos', filasNuevas);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('SELECT 1');
  },
};
