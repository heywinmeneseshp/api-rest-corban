'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // CREATE TABLE IF NOT EXISTS proformas
    await queryInterface.createTable('proformas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      numero: { type: Sequelize.STRING(50), allowNull: false, unique: true, comment: 'Número correlativo PROF-0001' },
      cliente: { type: Sequelize.STRING(200), allowNull: false, comment: 'Nombre del cliente' },
      cliente_identificacion: { type: Sequelize.STRING(50), allowNull: true },
      cliente_email: { type: Sequelize.STRING(150), allowNull: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      fecha_vigencia: { type: Sequelize.DATEONLY, allowNull: true, comment: 'Vigencia de la proforma' },
      descuento: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0, comment: 'Descuento global' },
      impuestos: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0, comment: 'Impuestos/IVA global' },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      estado: {
        type: Sequelize.ENUM('BORRADOR', 'APROBADA', 'ENVIADA', 'CONVERTIDA', 'VENCIDA', 'CANCELADA'),
        allowNull: false,
        defaultValue: 'BORRADOR',
      },
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
    await queryInterface.addIndex('proformas', ['fecha']);
    await queryInterface.addIndex('proformas', ['estado']);
    await queryInterface.addIndex('proformas', ['cliente']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('proformas');
  },
};
