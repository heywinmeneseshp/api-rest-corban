'use strict';

// Historial de lo que se cambió al ejecutar una aspersión: cantidades modificadas e insumos adicionales (cantidad_anterior NULL).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aspersion_cantidad_ajustes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      aspersion_programacion_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'aspersion_programaciones', key: 'id' }, onDelete: 'CASCADE' },
      articulo_nombre: { type: Sequelize.STRING(200), allowNull: false },
      unidad_simbolo: { type: Sequelize.STRING(20), allowNull: true },
      cantidad_anterior: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      cantidad_nueva: { type: Sequelize.DECIMAL(14, 4), allowNull: false },
      usuario_id: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('aspersion_cantidad_ajustes', ['aspersion_programacion_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aspersion_cantidad_ajustes');
  },
};
