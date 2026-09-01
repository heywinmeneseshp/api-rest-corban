'use strict';

// Agrega RUTINARIO y ADECUACION al ENUM `tipo` de planes_mantenimiento y
// ordenes_mantenimiento (antes solo PREVENTIVO/CORRECTIVO/PREDICTIVO/OTRO).
// MySQL no tiene "ALTER TYPE ADD VALUE" como Postgres — hay que redeclarar el
// ENUM completo con MODIFY COLUMN. El orden de valores no afecta filas
// existentes (MySQL guarda el string, no el índice, salvo que se use como
// entero explícitamente, lo cual no es el caso acá).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('planes_mantenimiento', 'tipo', {
      type: Sequelize.ENUM('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    });
    await queryInterface.changeColumn('ordenes_mantenimiento', 'tipo', {
      type: Sequelize.ENUM('PREVENTIVO', 'RUTINARIO', 'CORRECTIVO', 'PREDICTIVO', 'ADECUACION', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    });
  },

  async down(queryInterface, Sequelize) {
    // Antes de volver al ENUM viejo, cualquier fila con RUTINARIO/ADECUACION
    // quedaría inválida — se reasignan a OTRO para que el down() no falle.
    await queryInterface.sequelize.query(
      "UPDATE planes_mantenimiento SET tipo = 'OTRO' WHERE tipo IN ('RUTINARIO', 'ADECUACION')",
    );
    await queryInterface.sequelize.query(
      "UPDATE ordenes_mantenimiento SET tipo = 'OTRO' WHERE tipo IN ('RUTINARIO', 'ADECUACION')",
    );
    await queryInterface.changeColumn('planes_mantenimiento', 'tipo', {
      type: Sequelize.ENUM('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    });
    await queryInterface.changeColumn('ordenes_mantenimiento', 'tipo', {
      type: Sequelize.ENUM('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
      allowNull: false,
      defaultValue: 'PREVENTIVO',
    });
  },
};
