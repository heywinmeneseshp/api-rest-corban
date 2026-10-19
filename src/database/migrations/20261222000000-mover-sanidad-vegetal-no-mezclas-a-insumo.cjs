'use strict';

// Todo lo que está en la categoría "Sanidad Vegetal" (ELABORADO) y NO es el
// artículo elaborado de una mezcla pasa a "Insumo Sanidad Vegetal" (INSUMO).
// La categoría "Sanidad Vegetal" se conserva (aunque quede vacía) porque es
// la que usan las mezclas para sus artículos elaborados.
const DESTINO = 'Insumo Sanidad Vegetal';
const ORIGEN = 'Sanidad Vegetal';

module.exports = {
  async up(queryInterface) {
    const q = queryInterface.sequelize;
    const buscar = async (nombre) => (await q.query('SELECT id FROM articulo_categorias WHERE nombre = :n AND deleted_at IS NULL', { replacements: { n: nombre } }))[0][0];

    let destino = await buscar(DESTINO);
    if (!destino) {
      const now = new Date();
      await queryInterface.bulkInsert('articulo_categorias', [
        { uuid: require('node:crypto').randomUUID(), nombre: DESTINO, tipo: 'INSUMO', estado: true, created_at: now, updated_at: now },
      ]);
      destino = await buscar(DESTINO);
    }
    const origen = await buscar(ORIGEN);
    if (!origen) return;

    await q.query(
      `UPDATE articulos SET categoria_id = :d, updated_at = NOW()
        WHERE categoria_id = :o AND deleted_at IS NULL
          AND id NOT IN (SELECT articulo_elaborado_id FROM mezclas WHERE articulo_elaborado_id IS NOT NULL AND deleted_at IS NULL)`,
      { replacements: { d: destino.id, o: origen.id } },
    );
  },

  async down() {
    // No se revierte: no se guardó la categoría anterior de cada artículo.
  },
};
