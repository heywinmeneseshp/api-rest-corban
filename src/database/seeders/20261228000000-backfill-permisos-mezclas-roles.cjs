'use strict';

// Los permisos de Mezclas (inventario.mezclas.*) pasan a aplicarse de verdad. Para que ningún rol pierda el acceso que hoy tiene:
//  - Ver mezclas: roles que ya tienen algún menú de Inventarios o de Sanidad Vegetal (la programación de aspersiones consulta mezclas).
//  - Crear / editar / eliminar / elaborar: roles que ya ven los submenús Mezclas o Pruebas de laboratorio.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q(`
      INSERT INTO rol_permisos (role_id, permiso_id, created_at)
      SELECT DISTINCT rp.role_id, destino.id, NOW()
        FROM rol_permisos rp
        JOIN permisos origen ON origen.id = rp.permiso_id
        JOIN permisos destino ON destino.codigo = 'inventario.mezclas.ver'
       WHERE (origen.codigo LIKE 'menu.inventarios%' OR origen.codigo LIKE 'menu.sanidad_vegetal%' OR origen.codigo LIKE 'sanidad_vegetal.%')
         AND NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`);
    await q(`
      INSERT INTO rol_permisos (role_id, permiso_id, created_at)
      SELECT DISTINCT rp.role_id, destino.id, NOW()
        FROM rol_permisos rp
        JOIN permisos origen ON origen.id = rp.permiso_id
        JOIN permisos destino ON destino.codigo IN ('inventario.mezclas.crear', 'inventario.mezclas.editar', 'inventario.mezclas.eliminar', 'inventario.mezclas.elaborar')
       WHERE origen.codigo IN ('menu.inventarios.elaboraciones', 'menu.inventarios.mezclas')
         AND NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`);
  },

  async down() {
    // Sin reversa: no se sabe cuáles asignaciones ya existían antes.
  },
};
