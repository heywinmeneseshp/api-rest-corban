'use strict';

// Antes, proforma.service.js#convertir() solo cambiaba el estado de la
// proforma a CONVERTIDA y devolvía un objeto "facturaPreview" armado en
// memoria, sin persistir nada — no había ninguna tabla de facturas real. Esta
// migración agrega la persistencia real: cada conversión de proforma crea un
// registro `facturas` + sus `factura_detalles`, con numeración correlativa
// propia (FACT-0001), independiente de la numeración de la proforma.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('facturas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      numero: { type: Sequelize.STRING(50), allowNull: false, unique: true, comment: 'Número correlativo FACT-0001' },
      proforma_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        comment: 'Una proforma se convierte en factura una sola vez',
        references: { model: 'proformas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cliente: { type: Sequelize.STRING(200), allowNull: false },
      cliente_identificacion: { type: Sequelize.STRING(50), allowNull: true },
      cliente_email: { type: Sequelize.STRING(150), allowNull: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      descuento: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      impuestos: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      estado: { type: Sequelize.ENUM('EMITIDA', 'ANULADA'), allowNull: false, defaultValue: 'EMITIDA' },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('facturas', ['fecha']);
    await queryInterface.addIndex('facturas', ['estado']);

    await queryInterface.createTable('factura_detalles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      factura_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'facturas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      precio_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      descuento: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0, comment: 'cantidad*precio - descuento' },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('factura_detalles', ['factura_id']);
    await queryInterface.addIndex('factura_detalles', ['producto_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('factura_detalles');
    await queryInterface.dropTable('facturas');
  },
};
