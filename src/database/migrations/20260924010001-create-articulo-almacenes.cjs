'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Almacenes a los que un artículo está asignado — un artículo SIN
    // almacenes asignados es visible en todos (mismo criterio "abierto por
    // defecto" que usuario_almacenes/usuario_fincas); asignarle uno o más
    // almacenes lo restringe a que solo se vea/seleccione desde esos.
    await queryInterface.createTable('articulo_almacenes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      articulo_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'articulos', key: 'id' } },
      almacen_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'almacenes', key: 'id' } },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('articulo_almacenes', {
      fields: ['articulo_id', 'almacen_id'],
      type: 'unique',
      name: 'articulo_almacenes_articulo_almacen_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('articulo_almacenes');
  },
};
