'use strict';

// Revisión de la programación de aspersión: quién la marcó como revisada y cuándo. Su firma va en el aviso de aspersión.
// Al editar la programación la revisión se borra (ya no es lo que se revisó).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('aspersion_programaciones', 'revisado_por_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('aspersion_programaciones', 'revisado_en', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aspersion_programaciones', 'revisado_en');
    await queryInterface.removeColumn('aspersion_programaciones', 'revisado_por_id');
  },
};
