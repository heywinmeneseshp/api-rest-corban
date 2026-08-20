'use strict';

const crypto = require('node:crypto');

// precipitacion_diaria.ver/.configurar ya protegen las rutas del backend
// (ver src/routes/agricola/precipitacionDiaria.routes.js) desde antes, pero
// nunca se insertaron en `permisos` — por eso no aparecían como opción para
// asignar a un rol en Maestros → Roles → Permisos, solo Administrador podía
// usar el módulo (bypass vía ALL_PERMISSION_CODES).
const CODIGOS = ['precipitacion_diaria.ver', 'precipitacion_diaria.configurar'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const permisos = PERMISSIONS_SEED.filter((p) => CODIGOS.includes(p.codigo));

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
    await queryInterface.bulkDelete('permisos', { codigo: { [Op.in]: CODIGOS } });
  },
};
