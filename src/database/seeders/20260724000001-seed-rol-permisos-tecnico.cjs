'use strict';

// Permisos mínimos para que el rol Técnico pueda usar app-movil sin 403:
// sincronizar catálogos (solo lectura) y registrar evaluaciones (los 3
// tipos) + la planta que generan. Nunca editar/eliminar — la app móvil no
// llama esos endpoints.
const CODIGOS_TECNICO = [
  'categoria_planta.ver',
  'tipo_evaluacion.ver',
  'semana.ver',
  'finca.ver',
  'lote.ver',
  'planta.ver',
  'planta.crear',
  'evaluacion.ver',
  'evaluacion.crear',
  'infeccion.ver',
  'infeccion.crear',
  'conteo_hojas.ver',
  'conteo_hojas.crear',
  'suma_bruta.ver',
  'suma_bruta.crear',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { ROLES } = await import('../../constants/roles.constants.js');
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const [tecnicoRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = :nombre LIMIT 1',
      { replacements: { nombre: ROLES.TECNICO }, type: QueryTypes.SELECT },
    );
    if (!tecnicoRole) return;

    const permisos = await queryInterface.sequelize.query(
      'SELECT id FROM permisos WHERE codigo IN (:codigos)',
      { replacements: { codigos: CODIGOS_TECNICO }, type: QueryTypes.SELECT },
    );
    if (permisos.length === 0) return;

    // Evita duplicar filas si este seeder corre más de una vez (ej. se
    // reintenta tras un corte) contra permisos ya asignados manualmente.
    const yaAsignados = await queryInterface.sequelize.query(
      'SELECT permiso_id FROM rol_permisos WHERE role_id = :roleId',
      { replacements: { roleId: tecnicoRole.id }, type: QueryTypes.SELECT },
    );
    const idsYaAsignados = new Set(yaAsignados.map((r) => r.permiso_id));
    const permisosFaltantes = permisos.filter((p) => !idsYaAsignados.has(p.id));
    if (permisosFaltantes.length === 0) return;

    await queryInterface.bulkInsert(
      'rol_permisos',
      permisosFaltantes.map((p) => ({
        role_id: tecnicoRole.id,
        permiso_id: p.id,
        created_at: now,
      })),
    );
  },

  async down(queryInterface) {
    const { ROLES } = await import('../../constants/roles.constants.js');
    const { QueryTypes } = await import('sequelize');

    const [tecnicoRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = :nombre LIMIT 1',
      { replacements: { nombre: ROLES.TECNICO }, type: QueryTypes.SELECT },
    );
    if (!tecnicoRole) return;

    const permisos = await queryInterface.sequelize.query(
      'SELECT id FROM permisos WHERE codigo IN (:codigos)',
      { replacements: { codigos: CODIGOS_TECNICO }, type: QueryTypes.SELECT },
    );

    await queryInterface.bulkDelete('rol_permisos', {
      role_id: tecnicoRole.id,
      permiso_id: permisos.map((p) => p.id),
    });
  },
};
