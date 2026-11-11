'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Crea los permisos de PERMISSIONS_SEED que no existan en la base (p. ej. menu.precalibracion nunca se había sembrado: el Administrador
  // lo tiene por bypass, pero sin la fila no se puede dar a otros roles). No asigna nada a ningún rol.
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos', { type: queryInterface.sequelize.QueryTypes.SELECT });
    const ya = new Set(existentes.map((r) => r.codigo));
    const now = new Date();
    const faltan = PERMISSIONS_SEED.filter((p) => !ya.has(p.codigo));
    if (faltan.length === 0) return;
    await queryInterface.bulkInsert(
      'permisos',
      faltan.map((p) => ({ uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now })),
    );
  },

  async down() {
    // Sin reversa: no se sabe cuáles se crearon aquí.
  },
};
