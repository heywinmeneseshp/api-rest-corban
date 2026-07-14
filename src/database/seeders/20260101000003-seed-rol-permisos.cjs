'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { ROLES } = await import('../../constants/roles.constants.js');
    const { QueryTypes } = await import('sequelize');
    const now = new Date();

    const [adminRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = :nombre LIMIT 1',
      { replacements: { nombre: ROLES.ADMINISTRADOR }, type: QueryTypes.SELECT },
    );

    const permisos = await queryInterface.sequelize.query('SELECT id FROM permisos', {
      type: QueryTypes.SELECT,
    });

    if (!adminRole || permisos.length === 0) return;

    await queryInterface.bulkInsert(
      'rol_permisos',
      permisos.map((p) => ({
        role_id: adminRole.id,
        permiso_id: p.id,
        created_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('rol_permisos', null, {});
  },
};
