'use strict';

const crypto = require('node:crypto');

// Escala estándar de Sigatoka negra: 12 estadios (de 1- a 6+) más el estadio
// 0 (sin estadio, que en la app móvil se envía como cadena vacía). Los valores
// numéricos se dejan en 0 para que el administrador los configure desde el
// módulo de administración (el cálculo de Suma Bruta siempre consulta la
// tabla en tiempo real).
const ESTADIOS = [
  { estadio: '0', orden: 0 },
  { estadio: '1-', orden: 1 },
  { estadio: '1+', orden: 2 },
  { estadio: '2-', orden: 3 },
  { estadio: '2+', orden: 4 },
  { estadio: '3-', orden: 5 },
  { estadio: '3+', orden: 6 },
  { estadio: '4-', orden: 7 },
  { estadio: '4+', orden: 8 },
  { estadio: '5-', orden: 9 },
  { estadio: '5+', orden: 10 },
  { estadio: '6-', orden: 11 },
  { estadio: '6+', orden: 12 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'estadios_sigatoka',
      ESTADIOS.map((e) => ({
        uuid: crypto.randomUUID(),
        estadio: e.estadio,
        valor: 0,
        orden: e.orden,
        estado: true,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('estadios_sigatoka', {
      estadio: ESTADIOS.map((e) => e.estadio),
    });
  },
};
