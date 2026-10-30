'use strict';

// Módulo del colaborador: GENERAL (Maestros → Colaboradores) o SANIDAD_VEGETAL (creado desde Sanidad Vegetal → Colaboradores).
// Es la misma tabla: Maestros ve a todos; Sanidad Vegetal solo los suyos, con sus propios permisos.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('colaboradores', 'modulo', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'GENERAL',
    });
    await queryInterface.addIndex('colaboradores', ['modulo'], { name: 'idx_colaboradores_modulo' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('colaboradores', 'idx_colaboradores_modulo');
    await queryInterface.removeColumn('colaboradores', 'modulo');
  },
};
