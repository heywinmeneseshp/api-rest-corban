'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comunicados', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      asunto: { type: Sequelize.STRING(200), allowNull: false },
      mensaje: { type: Sequelize.TEXT, allowNull: false },
      // Snapshot de a quién se le mandó (nombres, no solo uuids/emails) —
      // para poder mostrar el historial sin depender de que esos roles o
      // usuarios sigan existiendo/activos más adelante.
      destinatarios_resumen: { type: Sequelize.JSON, allowNull: true },
      // Resultado por destinatario: [{ email, nombre, ok, error }]
      resultados: { type: Sequelize.JSON, allowNull: true },
      total_destinatarios: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      enviados_ok: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      enviados_error: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comunicados');
  },
};
