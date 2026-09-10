'use strict';

const crypto = require('node:crypto');

// Catálogo básico de unidades de medida para artículos/movimientos de
// inventario — solo MASA, VOLUMEN y UNIDAD (pedido explícito: sin
// LONGITUD/SUPERFICIE/TIEMPO). Idempotente por `codigo` (columna UNIQUE):
// solo inserta las que todavía no existan, para no chocar con unidades ya
// creadas a mano desde el módulo (ej. L, Gal, Kg, ml ya existían antes de
// este seeder).
const UNIDADES = [
  // MASA
  { codigo: 'g', nombre: 'Gramo', simbolo: 'g', tipo: 'MASA' },
  { codigo: 'Kg', nombre: 'Kilogramo', simbolo: 'Kg', tipo: 'MASA' },
  { codigo: 'Ton', nombre: 'Tonelada', simbolo: 'Ton', tipo: 'MASA' },
  { codigo: 'Lb', nombre: 'Libra', simbolo: 'Lb', tipo: 'MASA' },
  // VOLUMEN
  { codigo: 'ml', nombre: 'Mililitro', simbolo: 'ml', tipo: 'VOLUMEN' },
  { codigo: 'L', nombre: 'Litro', simbolo: 'L', tipo: 'VOLUMEN' },
  { codigo: 'Gal', nombre: 'Galón', simbolo: 'Gal', tipo: 'VOLUMEN' },
  // UNIDAD
  { codigo: 'Und', nombre: 'Unidad', simbolo: 'und', tipo: 'UNIDAD' },
  { codigo: 'Doc', nombre: 'Docena', simbolo: 'doc', tipo: 'UNIDAD' },
  { codigo: 'Caja', nombre: 'Caja', simbolo: 'caja', tipo: 'UNIDAD' },
  { codigo: 'Bulto', nombre: 'Bulto', simbolo: 'bulto', tipo: 'UNIDAD' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM unidades_medida', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const codigosExistentes = new Set(existentes.map((u) => u.codigo));

    const faltantes = UNIDADES.filter((u) => !codigosExistentes.has(u.codigo));
    if (!faltantes.length) return;

    await queryInterface.bulkInsert(
      'unidades_medida',
      faltantes.map((u) => ({
        uuid: crypto.randomUUID(),
        codigo: u.codigo,
        nombre: u.nombre,
        simbolo: u.simbolo,
        tipo: u.tipo,
        estado: true,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('unidades_medida', {
      codigo: UNIDADES.map((u) => u.codigo),
    });
  },
};
