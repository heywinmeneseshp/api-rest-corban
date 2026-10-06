'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Ingredientes activos asignados a un artículo — N:M, opcional (un
    // insumo puede tener varios, o ninguno). Mismo patrón que
    // articulo_almacenes.
    await queryInterface.createTable('articulo_ingredientes_activos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      articulo_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'articulos', key: 'id' } },
      ingrediente_activo_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'ingredientes_activos', key: 'id' } },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('articulo_ingredientes_activos', {
      fields: ['articulo_id', 'ingrediente_activo_id'],
      type: 'unique',
      name: 'articulo_ingredientes_activos_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('articulo_ingredientes_activos');
  },
};
