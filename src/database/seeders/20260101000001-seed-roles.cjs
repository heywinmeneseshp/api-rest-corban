'use strict';

const crypto = require('node:crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { ROLES } = await import('../../constants/roles.constants.js');
    const now = new Date();

    await queryInterface.bulkInsert('roles', [
      {
        uuid: crypto.randomUUID(),
        nombre: ROLES.ADMINISTRADOR,
        descripcion: 'Acceso total al sistema',
        created_at: now,
        updated_at: now,
      },
      {
        uuid: crypto.randomUUID(),
        nombre: ROLES.SUPERVISOR,
        descripcion: 'Supervisa evaluaciones y personal técnico',
        created_at: now,
        updated_at: now,
      },
      {
        uuid: crypto.randomUUID(),
        nombre: ROLES.TECNICO,
        descripcion: 'Registra evaluaciones de campo',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', null, {});
  },
};
