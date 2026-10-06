'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const codigos = [
      PERMISSIONS.MENU_SANIDAD_VEGETAL_COMPROBANTES_ASPERSION,
      PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER,
      PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR,
      PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EMITIR,
      PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ELIMINAR,
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
        'menu.sanidad_vegetal.comprobantes_aspersion',
        'sanidad_vegetal.comprobantes_aspersion.ver',
        'sanidad_vegetal.comprobantes_aspersion.editar',
        'sanidad_vegetal.comprobantes_aspersion.emitir',
        'sanidad_vegetal.comprobantes_aspersion.eliminar',
      ],
    });
  },
};
