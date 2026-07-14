'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('infecciones', {
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
      hojas_totales: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      yli: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0, field: 'yli' },
      yls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0, field: 'yls' },
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
    // evaluacion_id ya queda indexado por la restricción unique de arriba (1 infección por evaluación).
  },

  async down(queryInterface) {
    await queryInterface.dropTable('infecciones');
  },
};
