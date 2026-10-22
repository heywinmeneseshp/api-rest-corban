'use strict';

// Conteo (toma de inventario físico) por almacén: cabecera + una línea por artículo con el saldo del sistema al crear el conteo,
// lo contado y, al cerrar, la diferencia y el movimiento de ajuste que generó.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conteos_inventario', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      almacen_id: { type: Sequelize.INTEGER, allowNull: false },
      categoria_id: { type: Sequelize.INTEGER, allowNull: true },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      estado: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'BORRADOR' },
      ciego: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      motivo_id: { type: Sequelize.INTEGER, allowNull: true },
      cerrado_at: { type: Sequelize.DATE, allowNull: true },
      cerrado_by: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('conteos_inventario', ['almacen_id', 'estado'], { name: 'idx_conteos_almacen_estado' });

    await queryInterface.createTable('conteos_inventario_detalle', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      conteo_id: { type: Sequelize.INTEGER, allowNull: false },
      articulo_id: { type: Sequelize.INTEGER, allowNull: false },
      saldo_sistema: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      cantidad_contada: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      saldo_cierre: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      diferencia: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      movimiento_id: { type: Sequelize.INTEGER, allowNull: true },
      observacion: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('conteos_inventario_detalle', ['conteo_id', 'articulo_id'], { unique: true, name: 'uq_conteo_detalle_articulo' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conteos_inventario_detalle');
    await queryInterface.dropTable('conteos_inventario');
  },
};
