'use strict';

// Registro de los correos de jornada incompleta: un aviso por colaborador y día, aunque el servidor se reinicie.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asistencia_avisos_jornada', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      colaborador_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE' },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('asistencia_avisos_jornada', ['colaborador_id', 'fecha'], { unique: true, name: 'uq_aviso_jornada_colaborador_fecha' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asistencia_avisos_jornada');
  },
};
