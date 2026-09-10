'use strict';

const crypto = require('node:crypto');

// Conversiones básicas para las unidades de MASA y VOLUMEN sembradas en
// 20260919000001-seed-unidades-medida-basicas.cjs. No hace falta un par
// por cada combinación posible: la calculadora de conversión del frontend
// (app-corbana/app/(app)/inventarios/unidades/page.js) encadena estas
// conversiones como un grafo bidireccional (cada par también habilita el
// sentido inverso), así que basta con conectar cada unidad a una "unidad
// puente" para que cualquier par dentro del mismo tipo quede resuelto —
// ej. Ton -> Kg -> g resuelve Ton -> g sin sembrar esa fila directamente.
// `factor`: "1 origen = factor * destino" (mismo criterio que
// unidad.service.js#createConversion).
const CONVERSIONES = [
  // MASA (puente: gramo)
  { origen: 'Kg', destino: 'g', factor: 1000 },
  { origen: 'Ton', destino: 'Kg', factor: 1000 },
  { origen: 'Lb', destino: 'g', factor: 453.59237 },
  // VOLUMEN (puente: mililitro)
  { origen: 'L', destino: 'ml', factor: 1000 },
  { origen: 'Gal', destino: 'L', factor: 3.785412 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const unidades = await queryInterface.sequelize.query('SELECT id, codigo FROM unidades_medida', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const idPorCodigo = new Map(unidades.map((u) => [u.codigo, u.id]));

    const existentes = await queryInterface.sequelize.query(
      'SELECT unidad_origen_id, unidad_destino_id FROM unidad_conversiones',
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const existentesSet = new Set(existentes.map((e) => `${e.unidad_origen_id}-${e.unidad_destino_id}`));

    const filas = [];
    for (const c of CONVERSIONES) {
      const origenId = idPorCodigo.get(c.origen);
      const destinoId = idPorCodigo.get(c.destino);
      // Si el seeder de unidades básicas no corrió antes (o alguien borró
      // la unidad), no hay a qué apuntar — se omite esa fila en vez de
      // fallar todo el seeder.
      if (!origenId || !destinoId) continue;
      if (existentesSet.has(`${origenId}-${destinoId}`)) continue;

      filas.push({
        uuid: crypto.randomUUID(),
        unidad_origen_id: origenId,
        unidad_destino_id: destinoId,
        factor: c.factor,
        created_at: now,
        updated_at: now,
      });
    }
    if (!filas.length) return;

    await queryInterface.bulkInsert('unidad_conversiones', filas);
  },

  async down(queryInterface) {
    const unidades = await queryInterface.sequelize.query('SELECT id, codigo FROM unidades_medida', {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const idPorCodigo = new Map(unidades.map((u) => [u.codigo, u.id]));

    for (const c of CONVERSIONES) {
      const origenId = idPorCodigo.get(c.origen);
      const destinoId = idPorCodigo.get(c.destino);
      if (!origenId || !destinoId) continue;
      await queryInterface.bulkDelete('unidad_conversiones', {
        unidad_origen_id: origenId,
        unidad_destino_id: destinoId,
      });
    }
  },
};
