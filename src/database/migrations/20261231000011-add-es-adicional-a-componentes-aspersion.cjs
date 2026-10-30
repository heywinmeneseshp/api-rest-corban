'use strict';

// Insumo ADICIONAL de una aspersión: se agregó a esa aspersión (al programar o al ejecutar) y no está en la receta de la
// mezcla. Los existentes se marcan comparando con la receta activa de su mezcla (mismo criterio que usaba la web).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('aspersion_programacion_componentes', 'es_adicional', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.sequelize.query(`
      UPDATE aspersion_programacion_componentes apc
        JOIN aspersion_programaciones ap ON ap.id = apc.aspersion_programacion_id
         SET apc.es_adicional = 1
       WHERE EXISTS (SELECT 1 FROM mezcla_versiones v WHERE v.mezcla_id = ap.mezcla_id AND v.activa = 1)
         AND NOT EXISTS (
               SELECT 1 FROM mezcla_versiones v
                 JOIN mezcla_componentes mc ON mc.mezcla_version_id = v.id
                WHERE v.mezcla_id = ap.mezcla_id AND v.activa = 1 AND mc.articulo_id = apc.articulo_id)`);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aspersion_programacion_componentes', 'es_adicional');
  },
};
