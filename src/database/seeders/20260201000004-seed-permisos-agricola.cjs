'use strict';

const crypto = require('node:crypto');

const FASE2_PREFIXES = [
  'finca.',
  'lote.',
  'planta.',
  'categoria_planta.',
  'tipo_evaluacion.',
  'semana.',
  'evaluacion.',
  'infeccion.',
  'conteo_hojas.',
  'suma_bruta.',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const fase2Permisos = PERMISSIONS_SEED.filter((p) =>
      FASE2_PREFIXES.some((prefix) => p.codigo.startsWith(prefix)),
    );

    await queryInterface.bulkInsert(
      'permisos',
      fase2Permisos.map((p) => ({
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
      [Op.or]: FASE2_PREFIXES.map((prefix) => ({ codigo: { [Op.like]: `${prefix}%` } })),
    });
  },
};
