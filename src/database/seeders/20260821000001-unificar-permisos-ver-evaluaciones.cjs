'use strict';

// El usuario pidió que ver las 3 evaluaciones (Índice de Infección, Conteo
// de Hojas, Suma Bruta) deje de exigir un permiso propio por tipo — con
// EVALUACION_VER (evaluacion.ver) alcanza para ver cualquiera de las tres y
// el panel Indicadores (ver src/routes/agricola/*.routes.js). Se borran de
// `permisos`; rol_permisos se limpia solo (ON DELETE CASCADE). Los de
// crear/editar (infeccion.crear, conteo_hojas.editar, etc.) NO se tocan —
// siguen siendo granulares por tipo.
const CODIGOS = ['infeccion.ver', 'conteo_hojas.ver', 'suma_bruta.ver'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: CODIGOS } });
  },

  async down(queryInterface) {
    const crypto = require('node:crypto');
    const nombres = {
      'infeccion.ver': 'Ver infecciones',
      'conteo_hojas.ver': 'Ver conteo de hojas',
      'suma_bruta.ver': 'Ver suma bruta',
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
