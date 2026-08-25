'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS ordenes_mantenimiento
    await queryInterface.createTable('ordenes_mantenimiento', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      numero: { type: Sequelize.STRING(50), allowNull: false, unique: true, comment: 'Número OM-0001' },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'planes_mantenimiento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      programacion_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'programaciones_mantenimiento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tipo: {
        type: Sequelize.ENUM('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
        allowNull: false,
        defaultValue: 'PREVENTIVO',
      },
      descripcion: { type: Sequelize.TEXT, allowNull: false },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      fecha_cierre: { type: Sequelize.DATEONLY, allowNull: true },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      almacen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Almacén de donde se descuentan repuestos',
      },
      estado: {
        type: Sequelize.ENUM('ABIERTA', 'EN_PROCESO', 'CERRADA', 'CANCELADA'),
        allowNull: false,
        defaultValue: 'ABIERTA',
      },
      prioridad: {
        type: Sequelize.ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA'),
        allowNull: false,
        defaultValue: 'MEDIA',
      },
      costo_total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('ordenes_mantenimiento', ['equipo_id']);
    await queryInterface.addIndex('ordenes_mantenimiento', ['estado']);
    await queryInterface.addIndex('ordenes_mantenimiento', ['fecha']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ordenes_mantenimiento');
  },
};
