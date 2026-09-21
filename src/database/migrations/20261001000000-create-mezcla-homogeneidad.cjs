'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Prueba de homogeneidad: a los 15 min, 30 min y 1 hora de mezclada,
    // se toma una foto y se confirma si sigue homogénea (no se separó) —
    // pedido explícito. Una fila por punto de control, creada/actualizada
    // cuando el operador la registra (no se precrean vacías).
    await queryInterface.createTable('mezcla_homogeneidades', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      mezcla_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezcla_versiones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      intervalo: { type: Sequelize.ENUM('15MIN', '30MIN', '60MIN'), allowNull: false },
      homogenea: { type: Sequelize.BOOLEAN, allowNull: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      medido_en: { type: Sequelize.DATE, allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    // Un solo registro por punto de control por prueba.
    await queryInterface.addConstraint('mezcla_homogeneidades', {
      fields: ['mezcla_version_id', 'intervalo'],
      type: 'unique',
      name: 'mezcla_homogeneidades_version_intervalo_unique',
    });

    // La foto de cada punto de control se asocia igual que las de una
    // etapa (mezcla_etapa_id ya existente) — mismo patrón, columna nueva.
    await queryInterface.addColumn('mezcla_fotos', 'mezcla_homogeneidad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'mezcla_homogeneidades', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_fotos', 'mezcla_homogeneidad_id');
    await queryInterface.dropTable('mezcla_homogeneidades');
  },
};
