'use strict';

// Pistas de aviación desde donde sale la aspersión aérea: cada una con sus correos, que reciben el aviso de aspersión de la pista.
// La programación de aspersión guarda la pista de la que sale (pista_id).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pistas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      correos: { type: Sequelize.JSON, allowNull: true },
      observaciones: { type: Sequelize.STRING(300), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addColumn('aspersion_programaciones', 'pista_id', { type: Sequelize.INTEGER, allowNull: true, after: 'medio' });
    await queryInterface.addIndex('aspersion_programaciones', ['finca_id', 'pista_id'], { name: 'idx_aspersion_finca_pista' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('aspersion_programaciones', 'idx_aspersion_finca_pista');
    await queryInterface.removeColumn('aspersion_programaciones', 'pista_id');
    await queryInterface.dropTable('pistas');
  },
};
