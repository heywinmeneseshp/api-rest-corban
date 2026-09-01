'use strict';

// Catálogo de proveedores externos, para reemplazar el campo de texto libre
// `orden_servicios.proveedor` (sin FK, propenso a duplicados por typo) por
// una entidad real. Se mantiene la columna `proveedor` (VARCHAR) como
// snapshot del nombre al momento del servicio — mismo patrón ya usado en el
// resto del módulo (ej. `finca_nombre`, `usuario_nombre`), para que el
// historial no dependa de que el proveedor siga existiendo/activo.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proveedores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      identificacion: { type: Sequelize.STRING(50), allowNull: true, comment: 'NIT/cédula/RUC según el país' },
      telefono: { type: Sequelize.STRING(30), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      direccion: { type: Sequelize.STRING(255), allowNull: true },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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
      deleted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addColumn('orden_servicios', 'proveedor_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'proveedores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('orden_servicios', ['proveedor_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('orden_servicios', ['proveedor_id']);
    await queryInterface.removeColumn('orden_servicios', 'proveedor_id');
    await queryInterface.dropTable('proveedores');
  },
};
