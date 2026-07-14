'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('hojas_infectadas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      infeccion_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'infecciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      numero_hoja: { type: Sequelize.INTEGER, allowNull: false },
      severidad: { type: Sequelize.INTEGER, allowNull: true },
      estadio: { type: Sequelize.INTEGER, allowNull: true },
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
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('hojas_infectadas', ['infeccion_id'], {
      name: 'idx_hojas_infectadas_infeccion_id',
    });
    await queryInterface.addIndex('hojas_infectadas', ['infeccion_id', 'numero_hoja'], {
      name: 'uq_hojas_infectadas_infeccion_numero',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('hojas_infectadas');
  },
};
