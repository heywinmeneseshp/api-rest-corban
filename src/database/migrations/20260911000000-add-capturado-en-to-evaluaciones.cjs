'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('evaluaciones', 'capturado_en', {
      type: Sequelize.DATE,
      allowNull: true,
      comment:
        'Hora local real en que el evaluador guardó la evaluación en la app móvil (aunque haya sincronizado después, sin conexión) — a diferencia de created_at, que es cuándo se insertó en el servidor.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('evaluaciones', 'capturado_en');
  },
};
