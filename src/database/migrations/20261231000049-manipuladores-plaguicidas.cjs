'use strict';

// Manipuladores de plaguicidas (personas que preparan y manipulan la mezcla): tabla propia, aparte de los colaboradores. Se
// eligen en el comprobante de aspersión y se crean desde su edición.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tablas.includes('manipuladores_plaguicidas')) return;
    await queryInterface.createTable('manipuladores_plaguicidas', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      documento: { type: Sequelize.STRING(30), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('manipuladores_plaguicidas');
  },
};
