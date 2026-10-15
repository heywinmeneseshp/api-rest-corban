'use strict';

// Reparto de las cajas proyectadas por producto: cada escenario elige productos del catálogo y el % de los kilos de cada uno.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proyeccion_productos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      escenario_id: { type: Sequelize.INTEGER, allowNull: false },
      producto_id: { type: Sequelize.INTEGER, allowNull: false },
      porcentaje: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('proyeccion_productos', ['escenario_id'], { name: 'idx_proy_prod_escenario' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('proyeccion_productos');
  },
};
