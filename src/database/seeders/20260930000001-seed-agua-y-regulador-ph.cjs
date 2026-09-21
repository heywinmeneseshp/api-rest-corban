'use strict';

const crypto = require('node:crypto');

// Artículos base para el flujo de Corrección de pH en Pruebas de Mezcla
// (ver mezcla.service.js#finalizar): el Agua se mide pero NUNCA debe
// descontar inventario (maneja_inventario = false, respetado por
// stock.helper.js#consumirStockConReceta), y el Regulador de pH sí lleva
// inventario normal — se usa desde la etapa CORRECCION_PH, nunca como
// componente de la receta permanente. Idempotente por `nombre` (columna
// UNIQUE en articulos/articulo_categorias): en un servidor donde ya se
// crearon a mano (como pasó en dev), no hace nada.
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [categoriaExistente] = await queryInterface.sequelize.query(
      "SELECT id FROM articulo_categorias WHERE nombre = 'Insumo Corbana' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    let categoriaId = categoriaExistente?.id;
    if (!categoriaId) {
      await queryInterface.bulkInsert('articulo_categorias', [
        {
          uuid: crypto.randomUUID(),
          nombre: 'Insumo Corbana',
          tipo: 'INSUMO',
          estado: true,
          created_at: now,
          updated_at: now,
        },
      ]);
      const [creada] = await queryInterface.sequelize.query(
        "SELECT id FROM articulo_categorias WHERE nombre = 'Insumo Corbana' LIMIT 1",
        { type: queryInterface.sequelize.QueryTypes.SELECT },
      );
      categoriaId = creada.id;
    }

    const [unidadLitro] = await queryInterface.sequelize.query(
      "SELECT id FROM unidades_medida WHERE codigo = 'L' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const [unidadKg] = await queryInterface.sequelize.query(
      "SELECT id FROM unidades_medida WHERE codigo = 'Kg' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    const existentes = await queryInterface.sequelize.query(
      "SELECT nombre FROM articulos WHERE nombre IN ('Agua', 'Regulador de pH')",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    const nombresExistentes = new Set(existentes.map((a) => a.nombre));

    const filas = [];
    if (!nombresExistentes.has('Agua')) {
      filas.push({
        uuid: crypto.randomUUID(),
        codigo: 'WTR',
        nombre: 'Agua',
        categoria_id: categoriaId,
        unidad_medida_id: unidadLitro?.id || null,
        costo_compra: 0,
        precio_venta: 0,
        // Pedido explícito: al agua no se le lleva inventario — ver
        // stock.helper.js#consumirStockConReceta.
        maneja_inventario: false,
        stock_minimo: 0,
        estado: true,
        created_at: now,
        updated_at: now,
      });
    }
    if (!nombresExistentes.has('Regulador de pH')) {
      filas.push({
        uuid: crypto.randomUUID(),
        codigo: null,
        nombre: 'Regulador de pH',
        categoria_id: categoriaId,
        // Es un producto en polvo/sólido, se dosifica por peso (pedido
        // explícito) — distinto del Agua, que es líquido.
        unidad_medida_id: unidadKg?.id || null,
        costo_compra: 0,
        precio_venta: 0,
        maneja_inventario: true,
        stock_minimo: 0,
        estado: true,
        created_at: now,
        updated_at: now,
      });
    }

    if (filas.length) {
      await queryInterface.bulkInsert('articulos', filas);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('articulos', { nombre: ['Agua', 'Regulador de pH'] });
  },
};
