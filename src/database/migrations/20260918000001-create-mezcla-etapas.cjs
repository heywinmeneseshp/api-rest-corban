'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mezcla_etapas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      mezcla_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezcla_versiones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      numero: { type: Sequelize.INTEGER, allowNull: false },
      // Qué componente se acaba de incorporar en esta etapa — nullable
      // porque una etapa puntualmente puede ser solo una re-medición sin
      // agregar nada nuevo.
      componente_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'mezcla_componentes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ph: { type: Sequelize.DECIMAL(4, 2), allowNull: false },
      ce: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      // Calculado y guardado al registrar la etapa, contra los parámetros
      // vigentes en ese momento — igual criterio que el resultado final.
      resultado: { type: Sequelize.ENUM('CUMPLE', 'NO_CUMPLE'), allowNull: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      medido_en: { type: Sequelize.DATE, allowNull: false },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('mezcla_etapas', ['mezcla_version_id', 'numero'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mezcla_etapas');
  },
};
