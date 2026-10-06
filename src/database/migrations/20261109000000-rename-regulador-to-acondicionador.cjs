'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // "Regulador de pH" y "ACONDICIONADOR" son el mismo producto (pedido
    // explícito) — se unifica en ACONDICIONADOR. Solo renombra si no existe
    // ya uno con ese nombre (evita violar el UNIQUE de articulos.nombre).
    const existentes = await queryInterface.sequelize.query(
      "SELECT nombre FROM articulos WHERE nombre IN ('Regulador de pH', 'ACONDICIONADOR')",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const nombres = new Set(existentes.map((a) => a.nombre));
    if (nombres.has('Regulador de pH') && !nombres.has('ACONDICIONADOR')) {
      await queryInterface.sequelize.query(
        "UPDATE articulos SET nombre = 'ACONDICIONADOR' WHERE nombre = 'Regulador de pH'",
      );
    }
  },

  async down(queryInterface) {
    const existentes = await queryInterface.sequelize.query(
      "SELECT nombre FROM articulos WHERE nombre IN ('Regulador de pH', 'ACONDICIONADOR')",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const nombres = new Set(existentes.map((a) => a.nombre));
    if (nombres.has('ACONDICIONADOR') && !nombres.has('Regulador de pH')) {
      await queryInterface.sequelize.query(
        "UPDATE articulos SET nombre = 'Regulador de pH' WHERE nombre = 'ACONDICIONADOR'",
      );
    }
  },
};
