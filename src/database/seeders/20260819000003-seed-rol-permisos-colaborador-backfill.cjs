'use strict';

// Backfill: los roles que ya administran Labores o su programación reciben
// automáticamente los permisos de Colaboradores — es un módulo nuevo pero
// estrechamente ligado a ese flujo (el responsable de una labor programada
// ahora es un Colaborador). codigoNuevo -> códigos "trigger" (alcanza con
// tener AL MENOS UNO para heredar el código nuevo).
const TRIGGERS = {
  'colaborador.ver': ['labor.ver', 'labor_programacion.ver'],
  'colaborador.crear': ['labor.crear', 'labor_programacion.crear'],
  'colaborador.editar': ['labor.editar', 'labor_programacion.editar'],
  'colaborador.eliminar': ['labor.eliminar', 'labor_programacion.eliminar'],
  'menu.maestros.colaboradores': ['menu.maestros.labores', 'labor.ver'],
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
