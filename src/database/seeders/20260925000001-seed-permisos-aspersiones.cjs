'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const codigos = [
      PERMISSIONS.MENU_SANIDAD_VEGETAL_ASPERSIONES,
      PERMISSIONS.SANIDAD_ASPERSIONES_VER,
      PERMISSIONS.SANIDAD_ASPERSIONES_CREAR,
      PERMISSIONS.SANIDAD_ASPERSIONES_EDITAR,
      PERMISSIONS.SANIDAD_ASPERSIONES_ELIMINAR,
      PERMISSIONS.SANIDAD_ASPERSIONES_EJECUTAR,
      PERMISSIONS.SANIDAD_ASPERSIONES_ENVIAR_CORREO,
    ];

    await queryInterface.bulkInsert(
      'permisos',
      codigos.map((codigo) => {
        const permiso = PERMISSIONS_SEED.find((p) => p.codigo === codigo);
        return { uuid: crypto.randomUUID(), codigo: permiso.codigo, nombre: permiso.nombre, created_at: now, updated_at: now };
      }),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', {
      codigo: [
        'menu.sanidad_vegetal.aspersiones',
        'sanidad_vegetal.aspersiones.ver',
        'sanidad_vegetal.aspersiones.crear',
        'sanidad_vegetal.aspersiones.editar',
        'sanidad_vegetal.aspersiones.eliminar',
        'sanidad_vegetal.aspersiones.ejecutar',
        'sanidad_vegetal.aspersiones.enviar_correo',
      ],
    });
  },
};
