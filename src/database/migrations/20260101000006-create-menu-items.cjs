'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('menu_items', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.UUIDV4,
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM('modulo', 'pagina', 'boton'),
        allowNull: false,
        defaultValue: 'pagina',
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'menu_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ruta: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      icono: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      orden: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      permiso_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'permisos', key: 'id' },
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
      deleted_by: {
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
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('menu_items', ['parent_id'], { name: 'idx_menu_items_parent_id' });
    await queryInterface.addIndex('menu_items', ['orden'], { name: 'idx_menu_items_orden' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('menu_items');
  },
};
