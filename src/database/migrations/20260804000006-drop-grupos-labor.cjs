'use strict';

// Limpieza: `grupos_labor` quedó huérfana cuando se renombró la migración
// original a `categorias_labor` (sequelize-cli la trató como una migración
// nueva y volvió a correr la creación de tabla bajo el nombre viejo). Nunca
// tuvo datos ni ningún modelo la referencia — `categorias_labor` es la
// tabla real en uso.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('grupos_labor');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('grupos_labor', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      updated_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },
};
