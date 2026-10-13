'use strict';

// Configuración de Precalibración: qué edades de cinta se precalibran y qué valores de calibrador existen. Una fila
// GLOBAL (finca_id NULL) y, opcionalmente, una fila por finca que la reemplaza. Si no hay filas se usan los valores por
// defecto del código (edades 9-12 y calibres 32/34/36).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('precalibracion_config', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      finca_id: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      edades: { type: Sequelize.JSON, allowNull: false },
      valores: { type: Sequelize.JSON, allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precalibracion_config');
  },
};
