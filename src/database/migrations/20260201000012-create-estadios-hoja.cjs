'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estadios_hoja', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      suma_bruta_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'suma_bruta', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      numero_hoja: { type: Sequelize.INTEGER, allowNull: false },
      estadio: { type: Sequelize.STRING(20), allowNull: true },
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

    await queryInterface.addIndex('estadios_hoja', ['suma_bruta_id'], {
      name: 'idx_estadios_hoja_suma_bruta_id',
    });
    await queryInterface.addIndex('estadios_hoja', ['suma_bruta_id', 'numero_hoja'], {
      name: 'uq_estadios_hoja_suma_bruta_numero',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estadios_hoja');
  },
};
