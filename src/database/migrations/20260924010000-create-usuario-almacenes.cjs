'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Almacenes asignados a un usuario — mismo patrón que usuario_fincas:
    // un usuario SIN almacenes asignados ve todos (sin restricción); asignarle
    // uno o más almacenes lo restringe solo a esos (ver utils/almacenScope.js).
    await queryInterface.createTable('usuario_almacenes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
      almacen_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'almacenes', key: 'id' } },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('usuario_almacenes', {
      fields: ['user_id', 'almacen_id'],
      type: 'unique',
      name: 'usuario_almacenes_user_almacen_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuario_almacenes');
  },
};
