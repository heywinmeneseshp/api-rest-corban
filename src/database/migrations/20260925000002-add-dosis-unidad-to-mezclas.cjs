'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Unidad en la que se expresa `dosis_por_hectarea` — puede ser distinta
    // de la unidad de rendimiento de la mezcla (ej. mezcla rinde en Litros
    // pero la dosis se define en Galones/ha). Se convierte contra
    // `unidad_conversiones` al calcular la cantidad real de una aspersión
    // (ver aspersionProgramacion.service.js).
    await queryInterface.addColumn('mezclas', 'dosis_por_hectarea_unidad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'unidades_medida', key: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezclas', 'dosis_por_hectarea_unidad_id');
  },
};
