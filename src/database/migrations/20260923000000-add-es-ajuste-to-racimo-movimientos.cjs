'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Un "ajuste" es un movimiento del MISMO tipo (EMBOLSE/REPIQUE/RECUSE/
    // PROCESADO) que corrige uno anterior, con cantidad que puede ser
    // negativa (ver racimoMovimiento.service.js) — no es un tipo nuevo, así
    // que los reportes de neto/curva (SUM(cantidad) GROUP BY tipo) ya lo
    // reflejan sin cambios. Este flag solo sirve para auditoría/UI.
    await queryInterface.addColumn('racimo_movimientos', 'es_ajuste', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('racimo_movimientos', 'es_ajuste');
  },
};
