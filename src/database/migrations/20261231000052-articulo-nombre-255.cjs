'use strict';

// Nombre del artículo hasta 255 caracteres: el nombre interno de las mezclas se genera con todos sus insumos e ingredientes activos.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('articulos', 'nombre', { type: Sequelize.STRING(255), allowNull: false });
  },
  async down() {},
};
