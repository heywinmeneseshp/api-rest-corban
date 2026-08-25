'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS programaciones_mantenimiento
    await queryInterface.createTable('programaciones_mantenimiento', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'planes_mantenimiento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fecha_programada: { type: Sequelize.DATEONLY, allowNull: false },
      fecha_ejecucion: { type: Sequelize.DATEONLY, allowNull: true },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      estado: {
        type: Sequelize.ENUM('PENDIENTE', 'PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'VENCIDA'),
        allowNull: false,
        defaultValue: 'PENDIENTE',
      },
      prioridad: {
        type: Sequelize.ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
        allowNull: false,
        defaultValue: 'MEDIA',
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('programaciones_mantenimiento', ['equipo_id']);
    await queryInterface.addIndex('programaciones_mantenimiento', ['plan_id']);
    await queryInterface.addIndex('programaciones_mantenimiento', ['fecha_programada']);
    await queryInterface.addIndex('programaciones_mantenimiento', ['estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('programaciones_mantenimiento');
  },
};
