'use strict';

// Los permisos de acción de Inventarios y Equipos (inventario.*) pasan a aplicarse de verdad (antes un bypass dejaba hacer todo a
// cualquiera con sesión). Para que ningún rol pierda lo que hoy puede hacer, a cada rol que ve una pantalla se le dan todos los
// permisos de esa pantalla; luego se ajustan a mano en Maestros → Roles → Permisos.
//   pantalla (permiso de menú) → permisos que recibe (prefijos)
const PANTALLAS = {
  'menu.inventarios.dashboard': ['inventario.dashboard.'],
  'menu.inventarios.articulos': ['inventario.articulos.'],
  'menu.inventarios.categorias': ['inventario.categorias.'],
  'menu.inventarios.unidades': ['inventario.unidades.'],
  'menu.inventarios.almacenes': ['inventario.almacenes.'],
  'menu.inventarios.motivos': ['inventario.motivos.'],
  // Movimientos incluye las pestañas Existencias, Kárdex y Conteo.
  'menu.inventarios.movimientos': ['inventario.movimientos.', 'inventario.conteos.'],
  'menu.inventarios.conteos': ['inventario.conteos.'],
  'menu.inventarios.proformas': ['inventario.proformas.', 'inventario.facturas.'],
  'menu.inventarios.facturas': ['inventario.facturas.'],
  'menu.inventarios.proveedores': ['inventario.proveedores.'],
  'menu.inventarios.equipos': ['inventario.equipos.'],
  'menu.inventarios.planes': ['inventario.planes.'],
  'menu.inventarios.programaciones': ['inventario.programaciones.'],
  'menu.inventarios.ordenes': ['inventario.ordenes.'],
  // Insumos (Sanidad Vegetal) usa los permisos de Artículos: es el mismo recurso.
  'menu.sanidad_vegetal.insumos': ['inventario.articulos.'],
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [menu, prefijos] of Object.entries(PANTALLAS)) {
      for (const prefijo of prefijos) {
        await queryInterface.sequelize.query(
          `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
           SELECT DISTINCT rp.role_id, destino.id, NOW()
             FROM rol_permisos rp
             JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = :menu
             JOIN permisos destino ON destino.codigo LIKE :patron
            WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
          { replacements: { menu, patron: `${prefijo}%` } },
        );
      }
    }
  },

  async down() {
    // Sin reversa: no se sabe cuáles asignaciones ya existían antes.
  },
};
