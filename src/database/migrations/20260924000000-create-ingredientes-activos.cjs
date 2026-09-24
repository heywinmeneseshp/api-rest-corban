'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Maestro de Ingredientes Activos (Sanidad Vegetal) — catálogo simple de
    // referencia (ej. Mancozeb, Propiconazol) para etiquetar/consultar qué
    // ingrediente activo compone cada agroquímico, mismo shape que
    // categorias_planta (nombre único + descripción + estado).
    await queryInterface.createTable('ingredientes_activos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      descripcion: { type: Sequelize.STRING(255), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ingredientes_activos');
  },
};
