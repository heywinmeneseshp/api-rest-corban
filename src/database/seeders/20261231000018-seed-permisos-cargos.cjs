'use strict';

const crypto = require('node:crypto');

// Permisos de Maestros → Cargos. Quien ya entra a Maestros → Usuarios recibe el acceso y «ver»; crear, editar y eliminar se
// asignan en Maestros → Roles (el Administrador los tiene todos).
const CODIGOS = ['menu.maestros.cargos', 'cargo.ver', 'cargo.crear', 'cargo.editar', 'cargo.eliminar'];
const CODIGOS_VER = ['menu.maestros.cargos', 'cargo.ver'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos WHERE codigo IN (:codigos)', {
      replacements: { codigos: CODIGOS },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const ya = new Set(existentes.map((p) => p.codigo));
    const now = new Date();
    const nuevos = PERMISSIONS_SEED.filter((p) => CODIGOS.includes(p.codigo) && !ya.has(p.codigo));
    if (nuevos.length) {
      await queryInterface.bulkInsert('permisos', nuevos.map((p) => ({ uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now })));
    }
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT DISTINCT rp.role_id, destino.id, NOW()
         FROM rol_permisos rp
         JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = 'menu.maestros.usuarios'
         JOIN permisos destino ON destino.codigo IN (:ver)
        WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
      { replacements: { ver: CODIGOS_VER } },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: CODIGOS });
  },
};
