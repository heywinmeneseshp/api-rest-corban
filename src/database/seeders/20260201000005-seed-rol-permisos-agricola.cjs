'use strict';

const FASE2_PREFIXES = [
  'finca.',
  'lote.',
  'planta.',
  'categoria_planta.',
  'tipo_evaluacion.',
  'semana.',
  'evaluacion.',
  'infeccion.',
  'conteo_hojas.',
  'suma_bruta.',
];

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

    const likeConditions = FASE2_PREFIXES.map((_, i) => `codigo LIKE :prefix${i}`).join(' OR ');
    const replacements = { nombre: ROLES.ADMINISTRADOR };
    FASE2_PREFIXES.forEach((prefix, i) => {
      replacements[`prefix${i}`] = `${prefix}%`;
    });

    const permisos = await queryInterface.sequelize.query(
      `SELECT id FROM permisos WHERE ${likeConditions}`,
      { replacements, type: QueryTypes.SELECT },
    );

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
    const { ROLES } = await import('../../constants/roles.constants.js');
    const { QueryTypes } = await import('sequelize');

    const [adminRole] = await queryInterface.sequelize.query(
      'SELECT id FROM roles WHERE nombre = :nombre LIMIT 1',
      { replacements: { nombre: ROLES.ADMINISTRADOR }, type: QueryTypes.SELECT },
    );
    if (!adminRole) return;

    const likeConditions = FASE2_PREFIXES.map((_, i) => `codigo LIKE :prefix${i}`).join(' OR ');
    const replacements = {};
    FASE2_PREFIXES.forEach((prefix, i) => {
      replacements[`prefix${i}`] = `${prefix}%`;
    });

    const permisos = await queryInterface.sequelize.query(
      `SELECT id FROM permisos WHERE ${likeConditions}`,
      { replacements, type: QueryTypes.SELECT },
    );

    await queryInterface.bulkDelete('rol_permisos', {
      role_id: adminRole.id,
      permiso_id: permisos.map((p) => p.id),
    });
  },
};
