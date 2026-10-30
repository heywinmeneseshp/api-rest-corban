'use strict';

const crypto = require('node:crypto');

// Permisos de Sanidad Vegetal → Colaboradores (propios, separados de los de Maestros → Colaboradores). No se asignan a ningún
// rol: se dan en Maestros → Roles (el Administrador los tiene todos).
const CODIGOS = [
  'menu.sanidad_vegetal.colaboradores',
  'sanidad_vegetal.colaboradores.ver',
  'sanidad_vegetal.colaboradores.crear',
  'sanidad_vegetal.colaboradores.editar',
  'sanidad_vegetal.colaboradores.eliminar',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos WHERE codigo IN (:codigos)', {
      replacements: { codigos: CODIGOS },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const ya = new Set(existentes.map((p) => p.codigo));
    const now = new Date();
    const nuevos = PERMISSIONS_SEED.filter((p) => CODIGOS.includes(p.codigo) && !ya.has(p.codigo));
    if (nuevos.length) {
      await queryInterface.bulkInsert('permisos', nuevos.map((p) => ({ uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now })));
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: CODIGOS });
  },
};
