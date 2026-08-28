'use strict';

// `movimientos_inventario.origen_movimiento_id` (usado para enlazar el
// movimiento ENTRADA de una transferencia/elaboración con su SALIDA origen)
// se creó como INTEGER suelto sin FK real, a diferencia de todas las demás
// relaciones de esta tabla. Se agrega acá — es auto-referenciada (apunta a
// la misma tabla), sin acción de borrado en cascada real (SET NULL: si se
// borra el movimiento origen, el enlace se pierde pero el movimiento
// enlazado no se afecta; en la práctica movimientos_inventario no tiene
// soft-delete ni se borra nunca, así que esto rara vez dispara).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('movimientos_inventario', {
      fields: ['origen_movimiento_id'],
      type: 'foreign key',
      name: 'fk_movimientos_inventario_origen',
      references: { table: 'movimientos_inventario', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('movimientos_inventario', ['origen_movimiento_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('movimientos_inventario', 'fk_movimientos_inventario_origen');
    await queryInterface.removeIndex('movimientos_inventario', ['origen_movimiento_id']);
  },
};
