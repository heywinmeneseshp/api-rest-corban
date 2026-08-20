'use strict';

// El usuario pidió que estas acciones dejen de ser granulares por rol —
// cualquier usuario autenticado puede hacerlas ya (ver
// src/routes/agricola/planta.routes.js y categoriaPlanta.routes.js). Se
// borran de `permisos`; rol_permisos se limpia solo (ON DELETE CASCADE).
// "Ver plantas" y "Eliminar categorías de planta" NO se tocan — siguen
// siendo granulares, el usuario no las pidió liberar.
const CODIGOS = [
  'planta.crear',
  'planta.editar',
  'planta.eliminar',
  'categoria_planta.ver',
  'categoria_planta.crear',
  'categoria_planta.editar',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: CODIGOS } });
  },

  async down(queryInterface) {
    const crypto = require('node:crypto');
    // No puede restaurarse desde PERMISSIONS_SEED (ya no están ahí) — se
    // recrean con los mismos nombres que tenían, por si hay que revertir.
    const nombres = {
      'planta.crear': 'Crear plantas',
      'planta.editar': 'Editar plantas',
      'planta.eliminar': 'Eliminar plantas',
      'categoria_planta.ver': 'Ver categorías de planta',
      'categoria_planta.crear': 'Crear categorías de planta',
      'categoria_planta.editar': 'Editar categorías de planta',
    };
    const now = new Date();
    await queryInterface.bulkInsert(
      'permisos',
      CODIGOS.map((codigo) => ({
        uuid: crypto.randomUUID(),
        codigo,
        nombre: nombres[codigo],
        created_at: now,
        updated_at: now,
      })),
    );
  },
};
