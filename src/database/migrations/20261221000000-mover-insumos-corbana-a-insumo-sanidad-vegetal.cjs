'use strict';

// Pasa todos los artículos de "Insumos Corbana" a "Insumo Sanidad Vegetal"
// (tipo INSUMO, la categoría fija de la pantalla Insumos de Sanidad Vegetal) y
// da de baja (borrado lógico) las categorías que se quedan sin artículos.
const DESTINO = 'Insumo Sanidad Vegetal';
const ORIGEN = 'Insumos Corbana';

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
    if (origen) {
      await q.query('UPDATE articulos SET categoria_id = :d, updated_at = NOW() WHERE categoria_id = :o AND deleted_at IS NULL', {
        replacements: { d: destino.id, o: origen.id },
      });
    }

    // Categorías sin ningún artículo vivo (la de destino se salva por tener artículos o por ser la fija).
    await q.query(
      `UPDATE articulo_categorias c SET c.deleted_at = NOW(), c.updated_at = NOW()
        WHERE c.deleted_at IS NULL AND c.id <> :d
          AND NOT EXISTS (SELECT 1 FROM articulos a WHERE a.categoria_id = c.id AND a.deleted_at IS NULL)`,
      { replacements: { d: destino.id } },
    );
  },

  async down() {
    // No se revierte: no se guardó la categoría anterior de cada artículo.
  },
};
