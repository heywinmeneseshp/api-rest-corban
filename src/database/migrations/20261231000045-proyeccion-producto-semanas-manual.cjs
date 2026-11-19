'use strict';

// Reparto por producto, modo MANUAL: contenedores escritos a mano para cada semana del año ({ "<numeroSemana>": contenedores }).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('proyeccion_productos');
    if (!cols.semanas_manual) await queryInterface.addColumn('proyeccion_productos', 'semanas_manual', { type: Sequelize.JSON, allowNull: true, after: 'fincas' });
  },
  async down(queryInterface) {
    const cols = await queryInterface.describeTable('proyeccion_productos');
    if (cols.semanas_manual) await queryInterface.removeColumn('proyeccion_productos', 'semanas_manual');
  },
};
