'use strict';

const crypto = require('node:crypto');

const PREFIXES = ['objetivo_evaluacion.', 'menu.sanidad_vegetal.objetivos'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const [existentes] = await queryInterface.sequelize.query(
      "SELECT codigo FROM permisos WHERE codigo LIKE 'objetivo_evaluacion.%' OR codigo LIKE 'menu.sanidad_vegetal.objetivos%'",
    );
    const codigosExistentes = new Set(existentes.map((r) => r.codigo));

    const permisos = PERMISSIONS_SEED.filter(
      (p) => PREFIXES.some((prefix) => p.codigo.startsWith(prefix)) && !codigosExistentes.has(p.codigo),
    );

    if (permisos.length === 0) return;

    await queryInterface.bulkInsert(
      'permisos',
      permisos.map((p) => ({
        uuid: crypto.randomUUID(),
        codigo: p.codigo,
        nombre: p.nombre,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('permisos', {
      [Op.or]: PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
