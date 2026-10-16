'use strict';

// "Mezclas" y "Pruebas de laboratorio" viven en el menú de Sanidad Vegetal,
// pero sus permisos decían "(Inventarios)". Solo cambia el nombre visible;
// los códigos (menu.inventarios.*) se quedan igual para no tocar los roles.
const NOMBRES = {
  'menu.inventarios.elaboraciones': {
    nuevo: 'Ver submenú Mezclas (Sanidad Vegetal)',
    viejo: 'Ver submenú Elaboraciones (Inventarios)',
  },
  'menu.inventarios.mezclas': {
    nuevo: 'Ver submenú Pruebas de laboratorio (Sanidad Vegetal)',
    viejo: 'Ver submenú Mezclas (Inventarios)',
  },
};

module.exports = {
  async up(queryInterface) {
    for (const [codigo, { nuevo }] of Object.entries(NOMBRES)) {
      await queryInterface.bulkUpdate('permisos', { nombre: nuevo }, { codigo });
    }
  },

  async down(queryInterface) {
    for (const [codigo, { viejo }] of Object.entries(NOMBRES)) {
      await queryInterface.bulkUpdate('permisos', { nombre: viejo }, { codigo });
    }
  },
};
