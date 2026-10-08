'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Límite de aplicaciones por código FRAC en los últimos 12 meses, por finca.
    // `max_aplicaciones` NULL = sin límite definido (no genera alertas).
    await queryInterface.createTable('frac_limites', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.literal('(UUID())') },
      frac_codigo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      max_aplicaciones: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    // Una fila (sin límite) por cada código FRAC ya presente en los ingredientes activos.
    await queryInterface.sequelize.query(`
      INSERT INTO frac_limites (uuid, frac_codigo)
      SELECT UUID(), t.frac_codigo FROM (
        SELECT DISTINCT frac_codigo FROM ingredientes_activos WHERE frac_codigo IS NOT NULL AND frac_codigo <> ''
      ) t
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('frac_limites');
  },
};
