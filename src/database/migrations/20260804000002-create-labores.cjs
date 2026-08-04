'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('labores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      categoria_labor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'categorias_labor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      color: { type: Sequelize.STRING(7), allowNull: false, defaultValue: '#16a34a' },
      // Clave de un icono de la paleta curada en app-corbana/lib/laborIcons.js
      // (ej. "GiFarmTractor"), no una ruta de archivo ni SVG.
      icono: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'FiClipboard' },
      duracion_default_minutos: { type: Sequelize.INTEGER, allowNull: true },
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
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // Un mismo nombre de labor no se repite dentro de la misma categoría (sí
    // puede repetirse en categorías distintas).
    await queryInterface.addIndex('labores', ['categoria_labor_id', 'nombre'], {
      name: 'idx_labores_categoria_nombre_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('labores');
  },
};
