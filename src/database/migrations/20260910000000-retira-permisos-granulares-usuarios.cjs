'use strict';

// El módulo Usuarios pasa a tener una sola restricción: poder ver el menú
// (menu.maestros.usuarios, ya existente) — quien lo tenga puede hacer TODO
// adentro (crear, editar, eliminar, asignar rol, asignar finca), sin
// permisos granulares aparte. Se retiran usuarios.ver/crear/editar/
// eliminar/asignar_rol/asignar_finca.
const CODIGOS_VIEJOS = [
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.eliminar',
  'usuarios.asignar_rol',
  'usuarios.asignar_finca',
];

module.exports = {
  async up(queryInterface) {
    // Cualquier rol que hoy tenga alguno de los permisos viejos recibe
    // 'menu.maestros.usuarios' (por si no lo tenía ya) antes de borrar esas
    // asignaciones — para no dejarlo sin acceso al módulo sin aviso.
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_by, created_at)
       SELECT DISTINCT rp.role_id, nuevo.id, rp.created_by, NOW()
       FROM rol_permisos rp
       INNER JOIN permisos viejo ON viejo.id = rp.permiso_id
       CROSS JOIN (SELECT id FROM permisos WHERE codigo = 'menu.maestros.usuarios') AS nuevo
       WHERE viejo.codigo IN (:codigos)
         AND NOT EXISTS (
           SELECT 1 FROM rol_permisos existente
           WHERE existente.role_id = rp.role_id AND existente.permiso_id = nuevo.id
         );`,
      { replacements: { codigos: CODIGOS_VIEJOS } },
    );

    await queryInterface.sequelize.query(
      `DELETE rp FROM rol_permisos rp
       INNER JOIN permisos p ON p.id = rp.permiso_id
       WHERE p.codigo IN (:codigos);`,
      { replacements: { codigos: CODIGOS_VIEJOS } },
    );
    await queryInterface.bulkDelete('permisos', { codigo: CODIGOS_VIEJOS });
  },

  async down(queryInterface) {
    const nombres = {
      'usuarios.ver': 'Ver usuarios',
      'usuarios.crear': 'Crear usuarios',
      'usuarios.editar': 'Editar usuarios',
      'usuarios.eliminar': 'Eliminar usuarios',
      'usuarios.asignar_rol': 'Asignar roles a usuarios',
      'usuarios.asignar_finca': 'Asignar fincas a usuarios',
    };
    const crypto = require('node:crypto');
    // Nota: recrea los permisos pero NO sus asignaciones a roles (se
    // perdieron al hacer up).
    await queryInterface.bulkInsert(
      'permisos',
      CODIGOS_VIEJOS.map((codigo) => ({
        uuid: crypto.randomUUID(),
        codigo,
        nombre: nombres[codigo],
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  },
};
