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

    // Idempotente: si el seeder ya corrió parcial, no reinsertar duplicados.
    const existentes = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo LIKE 'finca.%' OR codigo LIKE 'lote.%' OR codigo LIKE 'planta.%' OR codigo LIKE 'categoria_planta.%' OR codigo LIKE 'tipo_evaluacion.%' OR codigo LIKE 'semana.%' OR codigo LIKE 'evaluacion.%' OR codigo LIKE 'infeccion.%' OR codigo LIKE 'conteo_hojas.%' OR codigo LIKE 'suma_bruta.%'`, {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const yaExisten = new Set(existentes.map((r) => r.codigo));
    const pendientes = fase2Permisos.filter((p) => !yaExisten.has(p.codigo));
    if (pendientes.length === 0) return;

    await queryInterface.bulkInsert(
      'permisos',
      pendientes.map((p) => ({
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
