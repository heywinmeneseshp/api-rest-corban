'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const perms = [
      'inventario.dashboard.ver',
      'inventario.categorias.ver', 'inventario.categorias.crear', 'inventario.categorias.editar', 'inventario.categorias.eliminar',
      'inventario.unidades.ver', 'inventario.unidades.crear', 'inventario.unidades.editar', 'inventario.unidades.eliminar',
      'inventario.productos.ver', 'inventario.productos.crear', 'inventario.productos.editar', 'inventario.productos.eliminar',
      'inventario.almacenes.ver', 'inventario.almacenes.crear', 'inventario.almacenes.editar', 'inventario.almacenes.eliminar',
      'menu.inventarios', 'menu.inventarios.dashboard', 'menu.inventarios.productos', 'menu.inventarios.categorias', 'menu.inventarios.unidades', 'menu.inventarios.almacenes',
    ];

    const existing = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo IN (:cods)`, {
      replacements: { cods: perms },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const ya = new Set(existing.map((r) => r.codigo));
    const pendientes = perms.filter((c) => !ya.has(c));
    if (pendientes.length === 0) return;

    // Mapea nombres desde PERMISSIONS_SEED si existe, sino usa código
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const map = new Map(PERMISSIONS_SEED.map((p) => [p.codigo, p.nombre]));

    await queryInterface.bulkInsert(
      'permisos',
      pendientes.map((codigo) => ({
        uuid: crypto.randomUUID(),
        codigo,
        nombre: map.get(codigo) || codigo,
        created_at: now,
        updated_at: now,
      })),
    );

    // Asigna todos a Administrador
    const [adminRole] = await queryInterface.sequelize.query(`SELECT id FROM roles WHERE nombre = 'Administrador' LIMIT 1`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (!adminRole) return;

    const nuevos = await queryInterface.sequelize.query(`SELECT id FROM permisos WHERE codigo IN (:cods)`, {
      replacements: { cods: pendientes },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const yaAsignados = await queryInterface.sequelize.query(`SELECT permiso_id FROM rol_permisos WHERE role_id = :rid`, {
      replacements: { rid: adminRole.id },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const setAsignados = new Set(yaAsignados.map((r) => r.permiso_id));
    const aAsignar = nuevos.filter((p) => !setAsignados.has(p.id));
    if (aAsignar.length) {
      await queryInterface.bulkInsert(
        'rol_permisos',
        aAsignar.map((p) => ({ role_id: adminRole.id, permiso_id: p.id, created_at: now })),
      );
    }
  },

  async down(queryInterface) {
    const perms = [
      'inventario.dashboard.ver',
      'inventario.categorias.ver', 'inventario.categorias.crear', 'inventario.categorias.editar', 'inventario.categorias.eliminar',
      'inventario.unidades.ver', 'inventario.unidades.crear', 'inventario.unidades.editar', 'inventario.unidades.eliminar',
      'inventario.productos.ver', 'inventario.productos.crear', 'inventario.productos.editar', 'inventario.productos.eliminar',
      'inventario.almacenes.ver', 'inventario.almacenes.crear', 'inventario.almacenes.editar', 'inventario.almacenes.eliminar',
      'menu.inventarios', 'menu.inventarios.dashboard', 'menu.inventarios.productos', 'menu.inventarios.categorias', 'menu.inventarios.unidades', 'menu.inventarios.almacenes',
    ];
    await queryInterface.bulkDelete('permisos', { codigo: perms });
  },
};
