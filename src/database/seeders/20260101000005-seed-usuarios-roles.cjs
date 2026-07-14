'use strict';

require('dotenv/config');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { ROLES } = await import('../../constants/roles.constants.js');
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const [adminUser] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE usuario = :usuario LIMIT 1',
      {
        replacements: { usuario: process.env.ADMIN_USUARIO || 'admin' },
        type: QueryTypes.SELECT,
      },
    );

    const [adminRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = :nombre LIMIT 1',
      { replacements: { nombre: ROLES.ADMINISTRADOR }, type: QueryTypes.SELECT },
    );

    if (!adminUser || !adminRole) return;

    await queryInterface.bulkInsert('usuarios_roles', [
      {
        user_id: adminUser.id,
        role_id: adminRole.id,
        created_by: adminUser.id,
        created_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('usuarios_roles', null, {});
  },
};
