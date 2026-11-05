'use strict';

// Lugares de asistencia asignados a un usuario (como usuario_fincas) y registro del resumen diario de jornadas incompletas.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuario_lugares', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      lugar_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'asistencia_lugares', key: 'id' }, onDelete: 'CASCADE' },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('usuario_lugares', ['user_id', 'lugar_id'], { unique: true, name: 'uq_usuario_lugar' });
    await queryInterface.createTable('asistencia_avisos_superior', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      usuario_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('asistencia_avisos_superior', ['usuario_id', 'fecha'], { unique: true, name: 'uq_aviso_superior_usuario_fecha' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asistencia_avisos_superior');
    await queryInterface.dropTable('usuario_lugares');
  },
};
