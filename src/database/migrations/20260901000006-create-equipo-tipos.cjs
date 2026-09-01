'use strict';

// Pedido del usuario: el ENUM fijo de Equipo.tipo (TRACTOR/VEHICULO/
// MAQUINARIA/EQUIPO/BOMBA/OTRO) era un catálogo cerrado a nivel de código —
// pasa a ser una tabla editable (como Categorías o Motivos), con un único
// tipo semilla ("Otro") en vez de la lista fija. Verificado antes de migrar:
// `equipos` tiene 0 filas en producción, sin dato real que preservar.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipo_tipos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.sequelize.query("INSERT INTO equipo_tipos (uuid, nombre, estado, created_at, updated_at) VALUES (UUID(), 'Otro', true, NOW(), NOW())");

    await queryInterface.removeColumn('equipos', 'tipo');
    await queryInterface.addColumn('equipos', 'tipo_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'equipo_tipos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('equipos', 'tipo_id');
    await queryInterface.addColumn('equipos', 'tipo', {
      type: Sequelize.ENUM('TRACTOR', 'VEHICULO', 'MAQUINARIA', 'EQUIPO', 'BOMBA', 'OTRO'),
      allowNull: false,
      defaultValue: 'OTRO',
    });
    await queryInterface.dropTable('equipo_tipos');
  },
};
