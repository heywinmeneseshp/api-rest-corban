'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS planes_mantenimiento
    await queryInterface.createTable('planes_mantenimiento', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      tipo: {
        type: Sequelize.ENUM('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO', 'OTRO'),
        allowNull: false,
        defaultValue: 'PREVENTIVO',
      },
      periodicidad_valor: { type: Sequelize.INTEGER, allowNull: false, comment: 'Cada cuánto' },
      periodicidad_unidad: {
        type: Sequelize.ENUM('DIAS', 'HORAS', 'KILOMETROS', 'HOROMETRO', 'MESES'),
        allowNull: false,
        defaultValue: 'DIAS',
      },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('planes_mantenimiento', ['equipo_id']);
    await queryInterface.addIndex('planes_mantenimiento', ['estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('planes_mantenimiento');
  },
};
