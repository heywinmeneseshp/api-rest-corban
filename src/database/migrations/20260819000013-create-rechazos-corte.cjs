'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rechazos_corte', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      fecha_rechazo: { type: Sequelize.DATEONLY, allowNull: false },
      // Fecha real de cosecha — en Logística es la fecha en la que se llenó
      // el contenedor con esa fruta; en Corbana se llama "fecha de corte"
      // (coherente con Programación de Corte). Puede quedar null si
      // Logística no encuentra el listado exacto del rechazo.
      fecha_corte: { type: Sequelize.DATEONLY, allowNull: true },
      finca_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'fincas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      semana_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      producto_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'productos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cajas: { type: Sequelize.INTEGER, allowNull: false },
      motivo: { type: Sequelize.STRING(150), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('rechazos_corte', ['semana_id', 'finca_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rechazos_corte');
  },
};
