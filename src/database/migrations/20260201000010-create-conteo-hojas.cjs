'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conteo_hojas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      evaluacion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'evaluaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      semana_embolse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      hojas_funcionales: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    // evaluacion_id ya queda indexado por la restricción unique de arriba (1 conteo por evaluación).
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conteo_hojas');
  },
};
