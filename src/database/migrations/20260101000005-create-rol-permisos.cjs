'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rol_permisos', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permiso_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'permisos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('rol_permisos', ['role_id', 'permiso_id'], {
      name: 'uq_rol_permisos_role_permiso',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rol_permisos');
  },
};
