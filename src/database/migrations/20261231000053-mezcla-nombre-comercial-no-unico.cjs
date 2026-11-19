'use strict';

// El nombre COMERCIAL de la mezcla puede repetirse (se genera con los insumos que salen en el comprobante y dos recetas pueden
// coincidir). El que identifica la mezcla es el nombre interno (artículo elaborado), que sigue siendo único.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [idx] = await queryInterface.sequelize.query("SHOW INDEX FROM mezclas WHERE Column_name = 'nombre' AND Non_unique = 0");
    for (const nombre of [...new Set(idx.map((i) => i.Key_name))]) await queryInterface.removeIndex('mezclas', nombre);
  },
  async down() {},
};
