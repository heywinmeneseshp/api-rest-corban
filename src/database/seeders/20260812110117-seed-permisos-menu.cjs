'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    // 'menu.' también matchea permisos legacy no relacionados (menu.ver/
    // crear/editar/eliminar, de la gestión de menú tipo CMS que ya existía)
    // — se filtran por code exacto contra la lista nueva, no por prefijo.
    const nuevosMenu = PERMISSIONS_SEED.filter(
      (p) => p.codigo.startsWith('menu.') && p.codigo !== 'menu.ver' && p.codigo !== 'menu.crear'
        && p.codigo !== 'menu.editar' && p.codigo !== 'menu.eliminar',
    );

    const existentes = await queryInterface.sequelize.query(
      'SELECT codigo FROM permisos WHERE codigo IN (:codigos)',
      { replacements: { codigos: nuevosMenu.map((p) => p.codigo) }, type: QueryTypes.SELECT },
    );
    const codigosExistentes = new Set(existentes.map((p) => p.codigo));
    const faltantes = nuevosMenu.filter((p) => !codigosExistentes.has(p.codigo));
    if (faltantes.length === 0) return;

    await queryInterface.bulkInsert(
      'permisos',
      faltantes.map((p) => ({
        uuid: crypto.randomUUID(),
        codigo: p.codigo,
        nombre: p.nombre,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    const { Op } = await import('sequelize');
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');

    const codigosMenu = PERMISSIONS_SEED.filter(
      (p) => p.codigo.startsWith('menu.') && p.codigo !== 'menu.ver' && p.codigo !== 'menu.crear'
        && p.codigo !== 'menu.editar' && p.codigo !== 'menu.eliminar',
    ).map((p) => p.codigo);
    if (codigosMenu.length === 0) return;

    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: codigosMenu } });
  },
};
