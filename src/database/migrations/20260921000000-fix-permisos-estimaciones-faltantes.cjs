'use strict';

const crypto = require('node:crypto');

// El seeder 20260901000002-seed-permiso-estimaciones.cjs quedó marcado como
// ejecutado en algunos ambientes ANTES de arreglarse, así que nunca llegó a
// insertar `estimacion.ver`, `estimacion.crear` ni `menu.estimaciones`
// (solo quedó `estimacion.editar_distribucion`, que se agregó por su propia
// migración aparte). Sin la fila `menu.estimaciones` en `permisos`, la
// opción "Estimaciones de Fincas" no aparece en Roles → "Habilitar menú"
// (el frontend filtra los códigos de menú que no existen como permiso real).
//
// Esta migración inserta las que falten, tomando el nombre de
// PERMISSIONS_SEED y saltando las que ya estén — es idempotente y segura de
// re-correr. No asigna el permiso a ningún rol: un Administrador lo habilita
// desde la pantalla de Roles cuando quiera.
const CLAVES = ['estimacion.ver', 'estimacion.crear', 'menu.estimaciones'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const now = new Date();

    const [existentes] = await queryInterface.sequelize.query(
      `SELECT codigo FROM permisos WHERE codigo IN (${CLAVES.map((c) => `'${c}'`).join(', ')})`,
    );
    const yaEstan = new Set(existentes.map((r) => r.codigo));

    const aInsertar = CLAVES.filter((c) => !yaEstan.has(c))
      .map((c) => PERMISSIONS_SEED.find((p) => p.codigo === c))
      .filter(Boolean)
      .map((p) => ({
        uuid: crypto.randomUUID(),
        codigo: p.codigo,
        nombre: p.nombre,
        created_at: now,
        updated_at: now,
      }));

    if (aInsertar.length === 0) return;
    await queryInterface.bulkInsert('permisos', aInsertar);
  },

  async down() {
    // No-op: no se borran permisos que pueden estar asignados a roles.
  },
};
