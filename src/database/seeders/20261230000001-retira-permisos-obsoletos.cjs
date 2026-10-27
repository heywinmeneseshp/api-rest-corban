'use strict';

// Retira permisos que ya no usa ninguna pantalla (ver permisosCatalogo.js): la gestión de ítems de menú tipo CMS y de permisos
// (ahora solo Administrador; los permisos los define el código), y menús que se movieron a Configuración (solo Administrador)
// o que nunca tuvieron pantalla propia (Facturas vive dentro de Proformas). Va como seeder y después de los demás para que
// ningún seeder viejo los vuelva a crear en una base nueva.
const CODIGOS = [
  'menu.ver',
  'menu.crear',
  'menu.editar',
  'menu.eliminar',
  'permisos.ver',
  'permisos.crear',
  'permisos.editar',
  'permisos.eliminar',
  'menu.maestros.version_app',
  'menu.cargue_masivo',
  'menu.inventarios.facturas',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Quien veía Facturas sin ver Proformas pasa a ver Proformas (Facturas está dentro de esa pantalla).
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT DISTINCT rp.role_id, destino.id, NOW()
         FROM rol_permisos rp
         JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = 'menu.inventarios.facturas'
         JOIN permisos destino ON destino.codigo IN ('menu.inventarios.proformas', 'inventario.proformas.ver', 'inventario.facturas.ver')
        WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
    );
    await queryInterface.sequelize.query(
      `DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo IN (:codigos)`,
      { replacements: { codigos: CODIGOS } },
    );
    await queryInterface.sequelize.query('DELETE FROM permisos WHERE codigo IN (:codigos)', { replacements: { codigos: CODIGOS } });
  },

  async down() {
    // Sin reversa: los permisos retirados no se usan en ninguna parte.
  },
};
