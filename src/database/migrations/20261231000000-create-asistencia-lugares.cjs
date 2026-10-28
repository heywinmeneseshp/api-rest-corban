'use strict';

// Lugares de asistencia distintos de las fincas (oficinas, plantas, bodegas...). Una marcación es en una finca O en un lugar.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asistencia_lugares', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      tipo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'OFICINA' },
      direccion: { type: Sequelize.STRING(200), allowNull: true },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.changeColumn('asistencia_marcaciones', 'finca_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('asistencia_marcaciones', 'lugar_id', { type: Sequelize.INTEGER, allowNull: true, after: 'finca_id' });
    await queryInterface.addIndex('asistencia_marcaciones', ['lugar_id', 'fecha_hora'], { name: 'idx_asistencia_lugar_fecha' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('asistencia_marcaciones', 'idx_asistencia_lugar_fecha');
    await queryInterface.removeColumn('asistencia_marcaciones', 'lugar_id');
    await queryInterface.changeColumn('asistencia_marcaciones', 'finca_id', { type: Sequelize.INTEGER, allowNull: false });
    await queryInterface.dropTable('asistencia_lugares');
  },
};
