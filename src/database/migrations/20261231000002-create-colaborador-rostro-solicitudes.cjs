'use strict';

// Solicitudes para volver a registrar el rostro de un colaborador que ya tiene uno: las capturas nuevas esperan aquí hasta que
// otro usuario con permiso las apruebe (reemplazan el rostro) o las rechace. Al resolverse, los vectores se borran.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('colaborador_rostro_solicitudes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      colaborador_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'colaboradores', key: 'id' }, onDelete: 'CASCADE' },
      muestras: { type: Sequelize.JSON, allowNull: true },
      parecido: { type: Sequelize.DECIMAL(6, 4), allowNull: true },
      estado: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'PENDIENTE' },
      nota: { type: Sequelize.STRING(300), allowNull: true },
      solicitado_por: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_por: { type: Sequelize.INTEGER, allowNull: true },
      resuelto_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('colaborador_rostro_solicitudes', ['colaborador_id', 'estado'], { name: 'idx_rostro_solicitud_colab_estado' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('colaborador_rostro_solicitudes');
  },
};
