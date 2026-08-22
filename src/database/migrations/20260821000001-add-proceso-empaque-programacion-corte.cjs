'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Proceso de empaque en Logística (Finca / Local / Puerto, etc.) —
    // Logística puede tener varias filas para la misma fecha+finca+producto,
    // una por cada proceso (ej. una parte se empaca en Finca y otra en
    // Local), y antes el UNIQUE (fecha, finca_id, producto_id) descartaba
    // todas menos una al sincronizar, perdiendo cajas reales. Default ''
    // (no NULL) para que el UNIQUE siga funcionando igual que antes para el
    // cargue manual, que no conoce el proceso de empaque.
    await queryInterface.addColumn('programacion_corte', 'proceso_empaque', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: '',
    });

    const [constraints] = await queryInterface.sequelize.query(
      "SHOW INDEX FROM programacion_corte WHERE Key_name = 'uq_fecha_finca_producto_programacion_corte'",
    );
    if (constraints.length > 0) {
      await queryInterface.removeConstraint('programacion_corte', 'uq_fecha_finca_producto_programacion_corte');
    }

    await queryInterface.addConstraint('programacion_corte', {
      fields: ['fecha', 'finca_id', 'producto_id', 'proceso_empaque'],
      type: 'unique',
      name: 'uq_fecha_finca_producto_proceso_programacion_corte',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('programacion_corte', 'uq_fecha_finca_producto_proceso_programacion_corte');

    await queryInterface.addConstraint('programacion_corte', {
      fields: ['fecha', 'finca_id', 'producto_id'],
      type: 'unique',
      name: 'uq_fecha_finca_producto_programacion_corte',
    });

    await queryInterface.removeColumn('programacion_corte', 'proceso_empaque');
  },
};
