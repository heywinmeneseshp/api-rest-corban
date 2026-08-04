'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabla de detalle: solo existe mientras exista su labor_series (sin
    // uuid ni soft-delete propios, vive y muere con la serie).
    await queryInterface.createTable('labor_serie_lotes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      labor_serie_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'labor_series', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      lote_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'lotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Define la secuencia round-robin en modo_lotes=ROTACION; se ignora en
      // modo_lotes=SIMULTANEO.
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('labor_serie_lotes', ['labor_serie_id'], {
      name: 'idx_labor_serie_lotes_serie',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('labor_serie_lotes');
  },
};
