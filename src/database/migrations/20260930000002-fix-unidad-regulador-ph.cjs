'use strict';

// El seeder 20260930000001 creó "Regulador de pH" con unidad Litro por
// error — es un producto en polvo/sólido, se dosifica por peso (Kg), no
// por volumen. Corrige el dato en cualquier servidor donde ya se haya
// creado mal; no toca nada si ya está en Kg o si el artículo no existe
// todavía (lo crea bien el seeder, en ese caso).
module.exports = {
  async up(queryInterface) {
    const [articulo] = await queryInterface.sequelize.query(
      "SELECT id, unidad_medida_id FROM articulos WHERE nombre = 'Regulador de pH' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (!articulo) return;

    const [unidadLitro] = await queryInterface.sequelize.query(
      "SELECT id FROM unidades_medida WHERE codigo = 'L' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (!unidadLitro || articulo.unidad_medida_id !== unidadLitro.id) return;

    const [unidadKg] = await queryInterface.sequelize.query(
      "SELECT id FROM unidades_medida WHERE codigo = 'Kg' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (!unidadKg) return;

    await queryInterface.sequelize.query('UPDATE articulos SET unidad_medida_id = :kg WHERE id = :id', {
      replacements: { kg: unidadKg.id, id: articulo.id },
    });
  },

  async down() {
    // No reversible con seguridad — no se sabe si el dato original en
    // Litro era intencional en algún servidor.
  },
};
