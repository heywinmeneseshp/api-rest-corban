'use strict';

// Backfill: los roles que ya administran Fincas reciben automáticamente los
// permisos de Productos — módulo nuevo pero estrechamente ligado (mismo
// patrón de sincronización con Logística). codigoNuevo -> códigos "trigger"
// (alcanza con tener AL MENOS UNO para heredar el código nuevo).
const TRIGGERS = {
  'producto.ver': ['finca.ver'],
  'producto.crear': ['finca.crear'],
  'producto.editar': ['finca.editar'],
  'producto.eliminar': ['finca.eliminar'],
  'menu.maestros.productos': ['menu.maestros.fincas', 'finca.ver'],
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
