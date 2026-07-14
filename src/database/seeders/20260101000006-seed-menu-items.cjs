'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS } = await import('../../constants/permissions.constants.js');
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const permisos = await queryInterface.sequelize.query(
      'SELECT id, codigo FROM permisos WHERE codigo IN (:codigos)',
      {
        replacements: {
          codigos: [
            PERMISSIONS.USUARIOS_VER,
            PERMISSIONS.ROLES_VER,
            PERMISSIONS.PERMISOS_VER,
            PERMISSIONS.MENU_VER,
          ],
        },
        type: QueryTypes.SELECT,
      },
    );
    const permisoIdByCodigo = Object.fromEntries(permisos.map((p) => [p.codigo, p.id]));

    const dashboardUuid = crypto.randomUUID();
    const adminUuid = crypto.randomUUID();

    await queryInterface.bulkInsert('menu_items', [
      {
        uuid: dashboardUuid,
        nombre: 'Dashboard',
        tipo: 'pagina',
        parent_id: null,
        ruta: '/dashboard',
        icono: 'home',
        orden: 1,
        permiso_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        uuid: adminUuid,
        nombre: 'Administración',
        tipo: 'modulo',
        parent_id: null,
        ruta: null,
        icono: 'settings',
        orden: 2,
        permiso_id: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    const [adminMenu] = await queryInterface.sequelize.query(
      'SELECT id FROM menu_items WHERE uuid = :uuid LIMIT 1',
      { replacements: { uuid: adminUuid }, type: QueryTypes.SELECT },
    );

    await queryInterface.bulkInsert('menu_items', [
      {
        uuid: crypto.randomUUID(),
        nombre: 'Usuarios',
        tipo: 'pagina',
        parent_id: adminMenu.id,
        ruta: '/administracion/usuarios',
        icono: 'users',
        orden: 1,
        permiso_id: permisoIdByCodigo[PERMISSIONS.USUARIOS_VER] || null,
        created_at: now,
        updated_at: now,
      },
      {
        uuid: crypto.randomUUID(),
        nombre: 'Roles',
        tipo: 'pagina',
        parent_id: adminMenu.id,
        ruta: '/administracion/roles',
        icono: 'shield',
        orden: 2,
        permiso_id: permisoIdByCodigo[PERMISSIONS.ROLES_VER] || null,
        created_at: now,
        updated_at: now,
      },
      {
        uuid: crypto.randomUUID(),
        nombre: 'Permisos',
        tipo: 'pagina',
        parent_id: adminMenu.id,
        ruta: '/administracion/permisos',
        icono: 'key',
        orden: 3,
        permiso_id: permisoIdByCodigo[PERMISSIONS.PERMISOS_VER] || null,
        created_at: now,
        updated_at: now,
      },
      {
        uuid: crypto.randomUUID(),
        nombre: 'Menú',
        tipo: 'pagina',
        parent_id: adminMenu.id,
        ruta: '/administracion/menu',
        icono: 'menu',
        orden: 4,
        permiso_id: permisoIdByCodigo[PERMISSIONS.MENU_VER] || null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('menu_items', null, {});
  },
};
