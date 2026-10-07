'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS, PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const codigos = [PERMISSIONS.AREA_LOTE_ACTUALIZAR_MASIVO];

    const existing = await queryInterface.sequelize.query(`SELECT codigo FROM permisos WHERE codigo IN (:cods)`, {
      replacements: { cods: codigos },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const ya = new Set(existing.map((r) => r.codigo));
    const pendientes = codigos.filter((c) => !ya.has(c));
    if (pendientes.length === 0) return;

    await queryInterface.bulkInsert(
      'permisos',
      pendientes.map((codigo) => {
        const permiso = PERMISSIONS_SEED.find((p) => p.codigo === codigo);
        return { uuid: crypto.randomUUID(), codigo: permiso.codigo, nombre: permiso.nombre, created_at: now, updated_at: now };
      }),
    );

    // No se asigna a ningún rol a propósito: es configurable desde
    // Maestros > Roles (Administrador lo tiene por bypass de
    // Object.values(PERMISSIONS), ver auth.service.js).
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', {
      codigo: ['area_lote.actualizar_masivo'],
    });
  },
};