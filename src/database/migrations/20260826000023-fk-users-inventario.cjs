'use strict';

// Las columnas de auditoría (created_by/updated_by/deleted_by/creada_por) de las
// tablas del módulo Inventarios se crearon como INTEGER sueltos, sin FK hacia
// `users` — a diferencia de la convención ya establecida en el resto del código
// (ver p.ej. programacion_corte). Se agregan aquí en una migración aparte porque
// las tablas ya existen con datos. Verificado sin huérfanos contra la base real
// antes de escribir esto (todas las columnas con 0 valores que no apunten a un
// usuario existente).
const TABLAS = [
  { tabla: 'producto_categorias', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'unidades_medida', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'unidad_conversiones', columnas: ['created_by', 'updated_by'] },
  { tabla: 'almacenes', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'motivos', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'mezclas', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'mezcla_versiones', columnas: ['creada_por'] },
  { tabla: 'proformas', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'equipos', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'planes_mantenimiento', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'programaciones_mantenimiento', columnas: ['created_by', 'updated_by', 'deleted_by'] },
  { tabla: 'ordenes_mantenimiento', columnas: ['created_by', 'updated_by', 'deleted_by'] },
];

function fkName(tabla, columna) {
  return `fk_${tabla}_${columna}`;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tablasExistentes = new Set((await queryInterface.showAllTables()).map((t) => String(t).toLowerCase()));

    for (const { tabla, columnas } of TABLAS) {
      if (!tablasExistentes.has(tabla)) continue;
      for (const columna of columnas) {
        await queryInterface.addConstraint(tabla, {
          fields: [columna],
          type: 'foreign key',
          name: fkName(tabla, columna),
          references: { table: 'users', field: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
    }
  },

  async down(queryInterface) {
    const tablasExistentes = new Set((await queryInterface.showAllTables()).map((t) => String(t).toLowerCase()));

    for (const { tabla, columnas } of TABLAS) {
      if (!tablasExistentes.has(tabla)) continue;
      for (const columna of columnas) {
        try {
          await queryInterface.removeConstraint(tabla, fkName(tabla, columna));
        } catch (_err) {
          void _err;
        }
      }
    }
  },
};
