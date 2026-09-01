'use strict';

// Tabla de saldo cacheado por (almacen, producto). Antes el stock se calculaba
// siempre sumando TODO el histórico de movimientos_inventario (ver
// stock.helper.js) — correcto pero cada vez más caro a medida que crece el
// histórico, sobre todo en el listado sin filtros (GET /movimientos/existencias)
// y en el "valor de inventario" del dashboard, que barren la tabla completa.
// Esta tabla guarda el saldo ya sumado y se mantiene al día en la misma
// transacción en la que se inserta cada movimiento (ver stock.helper.js
// aplicarDelta()) — el histórico de movimientos_inventario sigue siendo la
// fuente de verdad (kárdex), esto es solo un cache derivado de esa fuente.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('existencias', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      almacen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'almacenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      saldo: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0, comment: 'Cache derivado de SUM(movimientos_inventario.cantidad_base) para este par' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    await queryInterface.addConstraint('existencias', {
      fields: ['almacen_id', 'producto_id'],
      type: 'unique',
      name: 'uniq_existencia_almacen_producto',
    });
    await queryInterface.addIndex('existencias', ['producto_id']);

    // Backfill: calcula el saldo actual de cada par (almacen, producto) que ya
    // tenga movimientos, para que el cache arranque consistente con el
    // histórico existente (no arranca en 0 perdiendo el stock real).
    await queryInterface.sequelize.query(`
      INSERT INTO existencias (almacen_id, producto_id, saldo, created_at, updated_at)
      SELECT
        almacen_id,
        producto_id,
        SUM(CASE
          WHEN tipo IN ('ENTRADA','AJUSTE_ENTRADA','TRANSFERENCIA_ENTRADA','ELABORACION_ENTRADA')
          THEN cantidad_base ELSE -cantidad_base END) AS saldo,
        NOW(),
        NOW()
      FROM movimientos_inventario
      GROUP BY almacen_id, producto_id
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('existencias');
  },
};
