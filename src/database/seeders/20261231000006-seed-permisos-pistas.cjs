'use strict';

const crypto = require('node:crypto');

// Permisos del módulo Pistas (Sanidad Vegetal → Pistas). Los roles que ya ven Programación de Aspersiones reciben el acceso y
// «Ver pistas»; crear, editar y eliminar pistas (y sus correos) se asignan a mano en Maestros → Roles.
const CODIGOS_VER = ['menu.sanidad_vegetal.pistas', 'pista.ver'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const codigos = ['menu.sanidad_vegetal.pistas', 'pista.ver', 'pista.crear', 'pista.editar', 'pista.eliminar'];
    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos WHERE codigo IN (:codigos)', {
      replacements: { codigos },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const ya = new Set(existentes.map((p) => p.codigo));
    const now = new Date();
    const nuevos = PERMISSIONS_SEED.filter((p) => codigos.includes(p.codigo) && !ya.has(p.codigo));
    if (nuevos.length) {
      await queryInterface.bulkInsert('permisos', nuevos.map((p) => ({ uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now })));
    }
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT DISTINCT rp.role_id, destino.id, NOW()
         FROM rol_permisos rp
         JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = 'menu.sanidad_vegetal.aspersiones'
         JOIN permisos destino ON destino.codigo IN (:ver)
        WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
      { replacements: { ver: CODIGOS_VER } },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: ['menu.sanidad_vegetal.pistas', 'pista.ver', 'pista.crear', 'pista.editar', 'pista.eliminar'] });
  },
};
