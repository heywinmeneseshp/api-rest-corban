'use strict';

require('dotenv/config');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin#12345', 10);

    await queryInterface.bulkInsert('users', [
      {
        uuid: crypto.randomUUID(),
        usuario: process.env.ADMIN_USUARIO || 'admin',
        nombre: process.env.ADMIN_NOMBRE || 'Administrador',
        apellido: process.env.ADMIN_APELLIDO || 'Sistema',
        email: process.env.ADMIN_EMAIL || 'admin@corbana.com',
        password: hashedPassword,
        estado: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'users',
      { usuario: process.env.ADMIN_USUARIO || 'admin' },
      {},
    );
  },
};
