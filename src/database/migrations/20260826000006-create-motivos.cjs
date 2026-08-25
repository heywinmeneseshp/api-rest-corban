'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('motivos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      codigo: { type: Sequelize.STRING(50), allowNull: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      tipo: { type: Sequelize.ENUM('AJUSTE', 'SALIDA', 'TRANSFERENCIA', 'ELABORACION', 'OTRO'), allowNull: false, defaultValue: 'OTRO' },
      requiere_observacion: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('motivos');
  },
};
