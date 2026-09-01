'use strict';

// Las 8 tablas de Inventarios que referenciaban `productos` pasan a
// referenciar `articulos` (ver migración anterior). Todas están vacías en
// producción (verificado), así que es un simple remove+add de columna sin
// dato que preservar. `existencias` y `equipo_componentes` tienen además un
// UNIQUE compuesto que incluye la columna — hay que quitarlo antes de tocar
// la columna y volver a crearlo con el nombre nuevo.
//
// Trampa real encontrada al correr esto: `almacen_id`/`equipo_id` no tienen
// NINGÚN índice propio — solo aparecen como columna líder del UNIQUE
// compuesto. InnoDB exige que la FK de esa columna (almacen_id -> almacenes,
// equipo_id -> equipos) siempre tenga algún índice que la respalde, así que
// MySQL rechaza el DROP del UNIQUE compuesto con "Cannot drop index ...:
// needed in a foreign key constraint" aunque la FK que se está quitando sea
// la de producto_id, no la de almacen_id/equipo_id. Hay que agregar un
// índice temporal de respaldo ANTES de quitar el compuesto, y borrarlo
// después de crear el compuesto nuevo (que vuelve a respaldar esa FK).
const TABLAS_SIMPLES = ['movimientos_inventario', 'mezcla_componentes', 'proforma_detalles', 'factura_detalles', 'orden_detalles'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const fkArticulo = (onDelete) => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'articulos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    for (const tabla of TABLAS_SIMPLES) {
      await queryInterface.removeColumn(tabla, 'producto_id');
      await queryInterface.addColumn(tabla, 'articulo_id', fkArticulo('RESTRICT'));
      await queryInterface.addIndex(tabla, ['articulo_id']);
    }

    // mezclas.producto_elaborado_id -> articulo_elaborado_id (sin índice propio)
    await queryInterface.removeColumn('mezclas', 'producto_elaborado_id');
    await queryInterface.addColumn('mezclas', 'articulo_elaborado_id', fkArticulo('RESTRICT'));

    // existencias: UNIQUE(almacen_id, producto_id) -> UNIQUE(almacen_id, articulo_id)
    await queryInterface.addIndex('existencias', ['almacen_id'], { name: 'tmp_existencias_almacen_id' });
    await queryInterface.removeConstraint('existencias', 'uniq_existencia_almacen_producto');
    await queryInterface.removeColumn('existencias', 'producto_id');
    await queryInterface.addColumn('existencias', 'articulo_id', fkArticulo('RESTRICT'));
    await queryInterface.addConstraint('existencias', {
      fields: ['almacen_id', 'articulo_id'],
      type: 'unique',
      name: 'uniq_existencia_almacen_articulo',
    });
    await queryInterface.addIndex('existencias', ['articulo_id']);
    await queryInterface.removeIndex('existencias', 'tmp_existencias_almacen_id');

    // equipo_componentes: UNIQUE(equipo_id, producto_id) -> UNIQUE(equipo_id, articulo_id)
    await queryInterface.addIndex('equipo_componentes', ['equipo_id'], { name: 'tmp_equipo_componentes_equipo_id' });
    await queryInterface.removeConstraint('equipo_componentes', 'uniq_equipo_producto');
    await queryInterface.removeColumn('equipo_componentes', 'producto_id');
    await queryInterface.addColumn('equipo_componentes', 'articulo_id', fkArticulo('CASCADE'));
    await queryInterface.addConstraint('equipo_componentes', {
      fields: ['equipo_id', 'articulo_id'],
      type: 'unique',
      name: 'uniq_equipo_articulo',
    });
    await queryInterface.removeIndex('equipo_componentes', 'tmp_equipo_componentes_equipo_id');
  },

  async down(queryInterface, Sequelize) {
    const fkProducto = (onDelete) => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'productos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.addIndex('equipo_componentes', ['equipo_id'], { name: 'tmp_equipo_componentes_equipo_id' });
    await queryInterface.removeConstraint('equipo_componentes', 'uniq_equipo_articulo');
    await queryInterface.removeColumn('equipo_componentes', 'articulo_id');
    await queryInterface.addColumn('equipo_componentes', 'producto_id', fkProducto('CASCADE'));
    await queryInterface.addConstraint('equipo_componentes', { fields: ['equipo_id', 'producto_id'], type: 'unique', name: 'uniq_equipo_producto' });
    await queryInterface.removeIndex('equipo_componentes', 'tmp_equipo_componentes_equipo_id');

    await queryInterface.addIndex('existencias', ['almacen_id'], { name: 'tmp_existencias_almacen_id' });
    await queryInterface.removeConstraint('existencias', 'uniq_existencia_almacen_articulo');
    await queryInterface.removeColumn('existencias', 'articulo_id');
    await queryInterface.addColumn('existencias', 'producto_id', fkProducto('RESTRICT'));
    await queryInterface.addConstraint('existencias', { fields: ['almacen_id', 'producto_id'], type: 'unique', name: 'uniq_existencia_almacen_producto' });
    await queryInterface.removeIndex('existencias', 'tmp_existencias_almacen_id');

    await queryInterface.removeColumn('mezclas', 'articulo_elaborado_id');
    await queryInterface.addColumn('mezclas', 'producto_elaborado_id', fkProducto('RESTRICT'));

    for (const tabla of TABLAS_SIMPLES) {
      await queryInterface.removeColumn(tabla, 'articulo_id');
      await queryInterface.addColumn(tabla, 'producto_id', fkProducto('RESTRICT'));
    }
  },
};
