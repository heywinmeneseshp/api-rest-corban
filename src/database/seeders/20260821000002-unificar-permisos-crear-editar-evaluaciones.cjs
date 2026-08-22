'use strict';

// Continúa lo de 20260821000001-unificar-permisos-ver-evaluaciones: el
// usuario pidió que crear/editar/eliminar cualquiera de las 3 evaluaciones
// (Índice de Infección, Conteo de Hojas, Suma Bruta) también use los
// permisos genéricos EVALUACION_CREAR/EVALUACION_EDITAR (evaluacion.crear /
// evaluacion.editar) en vez de uno propio por tipo — ver
// src/routes/agricola/{infeccion,conteoHojas,sumaBruta}.routes.js. No hay
// "eliminar" propio por tipo (ya usaban evaluacion.eliminar). Se borran de
// `permisos`; rol_permisos se limpia solo (ON DELETE CASCADE).
const CODIGOS = [
  'infeccion.crear',
  'infeccion.editar',
  'conteo_hojas.crear',
  'conteo_hojas.editar',
  'suma_bruta.crear',
  'suma_bruta.editar',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: CODIGOS } });
  },

  async down(queryInterface) {
    const crypto = require('node:crypto');
    const nombres = {
      'infeccion.crear': 'Crear infecciones',
      'infeccion.editar': 'Editar infecciones',
      'conteo_hojas.crear': 'Crear conteo de hojas',
      'conteo_hojas.editar': 'Editar conteo de hojas',
      'suma_bruta.crear': 'Crear suma bruta',
      'suma_bruta.editar': 'Editar suma bruta',
    };
    const now = new Date();
    await queryInterface.bulkInsert(
      'permisos',
      CODIGOS.map((codigo) => ({
        uuid: crypto.randomUUID(),
        codigo,
        nombre: nombres[codigo],
        created_at: now,
        updated_at: now,
      })),
    );
  },
};
