'use strict';

// El usuario pidió que "ver" los catálogos de Tipos de Evaluación y
// Estadios de Sigatoka sea libre para cualquier autenticado (igual que
// fincas/semanas — dato de referencia no sensible), y que crear/editar/
// eliminar queden reservados solo al rol Administrador (requireAdmin en el
// código, no un permiso asignable por rol) — ver
// src/routes/agricola/{tipoEvaluacion,estadioSigatoka}.routes.js. Se borran
// los 8 códigos de `permisos`; rol_permisos se limpia solo (ON DELETE
// CASCADE).
const CODIGOS = [
  'tipo_evaluacion.ver',
  'tipo_evaluacion.crear',
  'tipo_evaluacion.editar',
  'tipo_evaluacion.eliminar',
  'estadio_sigatoka.ver',
  'estadio_sigatoka.crear',
  'estadio_sigatoka.editar',
  'estadio_sigatoka.eliminar',
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
      'tipo_evaluacion.ver': 'Ver tipos de evaluación',
      'tipo_evaluacion.crear': 'Crear tipos de evaluación',
      'tipo_evaluacion.editar': 'Editar tipos de evaluación',
      'tipo_evaluacion.eliminar': 'Eliminar tipos de evaluación',
      'estadio_sigatoka.ver': 'Ver estadios de Sigatoka',
      'estadio_sigatoka.crear': 'Crear estadios de Sigatoka',
      'estadio_sigatoka.editar': 'Editar estadios de Sigatoka',
      'estadio_sigatoka.eliminar': 'Eliminar estadios de Sigatoka',
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
