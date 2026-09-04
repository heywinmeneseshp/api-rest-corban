'use strict';

const crypto = require('node:crypto');

// Permiso muerto: nunca se usó en ninguna ruta/controlador de Estimaciones de
// Fincas (la edición puntual de una fila se hace re-guardando desde la grilla,
// que usa ESTIMACION_CREAR). Se confirmó antes de borrar que no está asignado
// a ningún rol (0 filas en rol_permisos con este permiso_id).
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: 'estimacion.editar' });
  },

  async down(queryInterface) {
    await queryInterface.bulkInsert('permisos', [
      {
        uuid: crypto.randomUUID(),
        codigo: 'estimacion.editar',
        nombre: 'Editar estimaciones de fincas',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
};
