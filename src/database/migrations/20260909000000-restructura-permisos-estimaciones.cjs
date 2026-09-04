'use strict';

const crypto = require('node:crypto');

// Rediseño de permisos de Estimaciones de Fincas a 3 niveles jerárquicos
// (ver → crear/guardar → editar_distribucion, resueltos con OR en las rutas
// vía permission(...codigos) — ver estimacionFinca.routes.js). Los permisos
// "eliminar" y "actualizar_masivo" se retiran como permisos aparte: esas
// acciones quedan disponibles solo para quien tenga el nivel más alto
// (estimacion.editar_distribucion).
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('permisos', [
      {
        uuid: crypto.randomUUID(),
        codigo: 'estimacion.editar_distribucion',
        nombre: 'Editar % de distribución del estimado (patrón de corte)',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    // Cualquier rol que hoy tenga 'estimacion.eliminar' o
    // 'estimacion.actualizar_masivo' (permisos que se retiran en este mismo
    // up) recibe automáticamente el nuevo permiso máximo
    // 'estimacion.editar_distribucion' — de lo contrario perdería esas
    // acciones sin aviso al correr esta migración (ambas rutas ahora exigen
    // solo el nivel más alto). Se hace ANTES de borrar las asignaciones
    // viejas, para todavía poder ver a quién estaban asignadas.
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_by, created_at)
       SELECT DISTINCT rp.role_id, nuevo.id, rp.created_by, NOW()
       FROM rol_permisos rp
       INNER JOIN permisos viejo ON viejo.id = rp.permiso_id
       CROSS JOIN (SELECT id FROM permisos WHERE codigo = 'estimacion.editar_distribucion') AS nuevo
       WHERE viejo.codigo IN ('estimacion.eliminar', 'estimacion.actualizar_masivo')
         AND NOT EXISTS (
           SELECT 1 FROM rol_permisos existente
           WHERE existente.role_id = rp.role_id AND existente.permiso_id = nuevo.id
         );`,
    );

    // Limpiar asignaciones a roles de los permisos que se van a borrar,
    // antes de borrarlos (rol_permisos referencia permiso_id por FK).
    await queryInterface.sequelize.query(
      `DELETE rp FROM rol_permisos rp
       INNER JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo IN ('estimacion.eliminar', 'estimacion.actualizar_masivo');`,
    );
    await queryInterface.bulkDelete('permisos', {
      codigo: ['estimacion.eliminar', 'estimacion.actualizar_masivo'],
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'estimacion.editar_distribucion' });

    // Nota: recrea los permisos pero NO sus asignaciones a roles (se
    // perdieron al hacer up) — igual patrón que
    // 20260904000000-elimina-permiso-estimacion-editar.cjs.
    await queryInterface.bulkInsert('permisos', [
      {
        uuid: crypto.randomUUID(),
        codigo: 'estimacion.eliminar',
        nombre: 'Eliminar estimaciones de fincas',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        uuid: crypto.randomUUID(),
        codigo: 'estimacion.actualizar_masivo',
        nombre: 'Actualizar en bloque estimaciones de fincas ya cargadas',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
};
