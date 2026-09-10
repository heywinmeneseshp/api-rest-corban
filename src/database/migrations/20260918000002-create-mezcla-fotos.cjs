'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mezcla_fotos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      mezcla_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mezcla_versiones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Nullable: por ahora las fotos se asocian a la prueba completa; a
      // futuro se pueden asociar a una etapa puntual sin migrar nada más.
      mezcla_etapa_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'mezcla_etapas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      id_drive: { type: Sequelize.STRING(100), allowNull: false },
      url_drive: { type: Sequelize.STRING(500), allowNull: true },
      nombre_original: { type: Sequelize.STRING(255), allowNull: true },
      nombre_drive: { type: Sequelize.STRING(255), allowNull: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mezcla_fotos');
  },
};
