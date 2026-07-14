'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evaluaciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      planta_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'plantas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      tipo_evaluacion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tipos_evaluacion', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      semana_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      observacion: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.addIndex('evaluaciones', ['planta_id'], { name: 'idx_evaluaciones_planta_id' });
    await queryInterface.addIndex('evaluaciones', ['fecha'], { name: 'idx_evaluaciones_fecha' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('evaluaciones');
  },
};
