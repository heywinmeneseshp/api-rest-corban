'use strict';

// Ejecución parcial: todas las partes de una aspersión van en UN comprobante. `comprobante_aspersion_partes` guarda cada parte
// (fecha, hectáreas, observaciones); la parte restante pendiente apunta al comprobante con `comprobante_parcial_id`, y cada
// participante lleva sus hectáreas (NULL = las aplicadas del comprobante).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('comprobante_aspersion_partes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      comprobante_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'comprobantes_aspersion', key: 'id' }, onDelete: 'CASCADE' },
      aspersion_programacion_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'aspersion_programaciones', key: 'id' } },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      hectareas: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('comprobante_aspersion_partes', ['comprobante_id']);
    await queryInterface.addColumn('aspersion_programaciones', 'comprobante_parcial_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'comprobantes_aspersion', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('comprobante_aspersion_participantes', 'hectareas', { type: Sequelize.DECIMAL(12, 2), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('comprobante_aspersion_participantes', 'hectareas');
    await queryInterface.removeColumn('aspersion_programaciones', 'comprobante_parcial_id');
    await queryInterface.dropTable('comprobante_aspersion_partes');
  },
};
