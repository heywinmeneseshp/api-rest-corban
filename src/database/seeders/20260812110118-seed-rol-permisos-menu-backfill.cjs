'use strict';

// Backfill de la nueva capa de permisos "menu.*" (ver
// src/constants/permissions.constants.js): para que ningún rol pierda
// acceso al desplegar el rediseño de navegación, a cada rol EXISTENTE
// (no una lista fija — los roles se crean dinámicamente desde Maestros →
// Roles) se le otorga el permiso de menú/submenú equivalente a lo que ya
// podía ver hoy en el Sidebar, replicando exactamente la misma lógica de
// visibilidad que tenía components/Sidebar.js antes de este cambio.
//
// codigoNuevo -> [códigos granulares "trigger"; alcanza con tener AL MENOS
// UNO para heredar el código nuevo].
const TRIGGERS = {
  'menu.maestros': [
    'finca.ver', 'grupo_finca.ver', 'area_lote.ver', 'usuarios.ver', 'roles.ver',
    'semana.ver', 'motivo_repique.ver', 'motivo_recuse.ver', 'categoria_labor.ver',
    'labor.ver', 'estadio_sigatoka.ver',
  ],
  'menu.maestros.fincas': ['finca.ver'],
  'menu.maestros.grupos_finca': ['grupo_finca.ver'],
  'menu.maestros.area_lotes': ['area_lote.ver'],
  'menu.maestros.usuarios': ['usuarios.ver'],
  'menu.maestros.roles': ['roles.ver'],
  'menu.maestros.semanas': ['semana.ver'],
  'menu.maestros.calendario': ['semana.ver'],
  'menu.maestros.motivos_repique': ['motivo_repique.ver'],
  'menu.maestros.motivos_recuse': ['motivo_recuse.ver'],
  'menu.maestros.categorias_labor': ['categoria_labor.ver'],
  'menu.maestros.labores': ['labor.ver'],
  'menu.maestros.estadios_sigatoka': ['estadio_sigatoka.ver'],
  'menu.maestros.version_app': ['roles.ver'],

  'menu.racimos': ['racimo_movimiento.ver', 'racimo_movimiento.crear'],
  'menu.racimos.movimientos': ['racimo_movimiento.ver'],
  'menu.racimos.registrar': ['racimo_movimiento.crear'],
  'menu.racimos.saldos_lotes_cintas': ['racimo_movimiento.ver'],
  'menu.racimos.reporte_embolses': ['racimo_movimiento.ver'],

  'menu.labores': ['labor.ver', 'labor_programacion.ver'],
  'menu.labores.calendario': ['labor_programacion.ver'],
  'menu.labores.estados': ['labor_programacion.ver'],

  'menu.sanidad_vegetal': ['infeccion.ver', 'labor_evaluacion.ver'],
  'menu.sanidad_vegetal.evaluaciones': ['infeccion.ver'],
  'menu.sanidad_vegetal.graficos': ['infeccion.ver'],
  'menu.sanidad_vegetal.labores': ['labor_evaluacion.ver'],

  'menu.precipitacion_diaria': ['precipitacion_diaria.ver'],
  'menu.produccion_semanal': ['produccion.ver'],
  'menu.pronostico': ['pronostico.ver'],
  'menu.reportes': ['evaluacion.ver'],
  'menu.cargue_masivo': [
    'finca.crear', 'lote.crear', 'racimo_movimiento.crear', 'motivo_repique.crear',
    'motivo_recuse.crear', 'produccion.crear', 'clima.crear',
  ],
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const roles = await queryInterface.sequelize.query('SELECT id, nombre FROM roles', { type: QueryTypes.SELECT });
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
        if (codigosDelRol.has(codigoNuevo)) continue; // ya lo tiene (seeder re-corrido)
        const permisoIdNuevo = idPorCodigo.get(codigoNuevo);
        if (!permisoIdNuevo) continue; // el seeder de permisos.* no corrió todavía

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
    // No revierte selectivamente el backfill (no hay forma de distinguir una
    // asignación hecha por este seeder de una hecha a mano después) — el
    // down real es el del seeder de permisos.* (20260812110117), que borra
    // los códigos menu.* y en cascada limpia rol_permisos.
    await queryInterface.sequelize.query('SELECT 1');
  },
};
