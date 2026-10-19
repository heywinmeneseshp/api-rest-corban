'use strict';

// La pantalla Insumos de Sanidad Vegetal lista por una categoría fija. Pasa a
// llamarse "Insumo Sanidad Vegetal" y es de tipo INSUMO ("Sanidad Vegetal"
// queda como categoría de ELABORADOS/mezclas). Crea la categoría si no existe
// y mueve a ella los productos cargados desde el inventario Excel del
// 2026-10-16 (identificados por el código del Excel).
const CODIGOS = [
  '004', '005', '006', '007', '008', '019', '022', '024', '027', '028', '029', '030', '031', '033', '038', '040',
  '047', '048', '050', '053', '055', '056', '057', '061', '064', '066', '067', '068', '069', '070', '071', '072', '074',
];
const NOMBRE = 'Insumo Sanidad Vegetal';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    let [cat] = await q.query('SELECT id FROM articulo_categorias WHERE nombre = :n AND deleted_at IS NULL', { replacements: { n: NOMBRE } });
    if (cat.length === 0) {
      const now = new Date();
      await queryInterface.bulkInsert('articulo_categorias', [
        { uuid: require('node:crypto').randomUUID(), nombre: NOMBRE, tipo: 'INSUMO', estado: true, created_at: now, updated_at: now },
      ]);
      [cat] = await q.query('SELECT id FROM articulo_categorias WHERE nombre = :n AND deleted_at IS NULL', { replacements: { n: NOMBRE } });
    }
    await q.query('UPDATE articulos SET categoria_id = :c, updated_at = NOW() WHERE codigo IN (:codigos) AND deleted_at IS NULL', {
      replacements: { c: cat[0].id, codigos: CODIGOS },
    });
  },

  async down() {
    // No se revierte: la categoría anterior de cada producto no se guardó.
  },
};
