'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estadios_sigatoka', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      // Estadio de la escala de Sigatoka: "1-", "1+", "2-", "2+", …, "6-", "6+".
      estadio: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      // Valor numérico configurable con el que se calcula la Suma Bruta.
      valor: { type: Sequelize.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      // Orden de aparición en formularios y reportes (1- = 1, 1+ = 2, …).
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estadios_sigatoka');
  },
};
