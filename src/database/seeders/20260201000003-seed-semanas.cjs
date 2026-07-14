'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const anio = 2026;
    const semanas = [
      { numero: 1, inicio: '2026-01-05', fin: '2026-01-11' },
      { numero: 2, inicio: '2026-01-12', fin: '2026-01-18' },
      { numero: 3, inicio: '2026-01-19', fin: '2026-01-25' },
      { numero: 4, inicio: '2026-01-26', fin: '2026-02-01' },
    ];

    await queryInterface.bulkInsert(
      'semanas',
      semanas.map((s) => ({
        uuid: crypto.randomUUID(),
        codigo: `${anio}-S${String(s.numero).padStart(2, '0')}`,
        numero_semana: s.numero,
        anio,
        fecha_inicio: s.inicio,
        fecha_fin: s.fin,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('semanas', null, {});
  },
};
