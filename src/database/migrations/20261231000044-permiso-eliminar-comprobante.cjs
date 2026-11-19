'use strict';

// Permiso para eliminar comprobantes de aspersión (la aspersión queda ejecutada). De entrada lo tiene «Director de Sanidad».
const crypto = require('node:crypto');
const CODIGO = 'sanidad_vegetal.comprobantes_aspersion.eliminar';

module.exports = {
  async up(queryInterface) {
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :c', { replacements: { c: CODIGO } });
    if (!existe.length) {
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [
        { uuid: crypto.randomUUID(), codigo: CODIGO, nombre: 'Eliminar comprobantes de aspersión (la aspersión queda ejecutada)', created_at: now, updated_at: now },
      ]);
    }
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT r.id, p.id, NOW() FROM roles r CROSS JOIN permisos p
        WHERE r.nombre = 'Director de Sanidad' AND r.deleted_at IS NULL AND p.codigo = :c
          AND NOT EXISTS (SELECT 1 FROM rol_permisos rp WHERE rp.role_id = r.id AND rp.permiso_id = p.id)`,
      { replacements: { c: CODIGO } },
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = :c', { replacements: { c: CODIGO } });
    await queryInterface.bulkDelete('permisos', { codigo: CODIGO });
  },
};
