'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS equipos
    await queryInterface.createTable('equipos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      codigo: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      tipo: {
        type: Sequelize.ENUM('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO'),
        allowNull: false,
        defaultValue: 'OTRO',
      },
      marca: { type: Sequelize.STRING(100), allowNull: true },
      modelo: { type: Sequelize.STRING(100), allowNull: true },
      serie: { type: Sequelize.STRING(100), allowNull: true },
      fecha_adquisicion: { type: Sequelize.DATEONLY, allowNull: true },
      ubicacion_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      centro_costo_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      estado: {
        type: Sequelize.ENUM('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'INACTIVO', 'DE_BAJA'),
        allowNull: false,
        defaultValue: 'OPERATIVO',
      },
      horometro: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      kilometraje: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      responsable_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('equipos', ['codigo']);
    await queryInterface.addIndex('equipos', ['estado']);
    await queryInterface.addIndex('equipos', ['tipo']);
    await queryInterface.addIndex('equipos', ['ubicacion_id']);
    await queryInterface.addIndex('equipos', ['centro_costo_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('equipos');
  },
};
