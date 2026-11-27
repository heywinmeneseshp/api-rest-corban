'use strict';

// Permiso «Registrar lecturas de equipos (km / horas)»: estaba en el catálogo y en las rutas, pero nunca se creó en la tabla
// `permisos`, así que no se podía marcar en ningún rol (solo «Editar equipos» daba acceso). Se crea y se le asigna al rol
// «Piloto dron» (si existe).
const crypto = require('node:crypto');
const CODIGO = 'inventario.equipos.lecturas';

module.exports = {
  async up(queryInterface) {
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :c', { replacements: { c: CODIGO } });
    if (!existe.length) {
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [
        { uuid: crypto.randomUUID(), codigo: CODIGO, nombre: 'Registrar lecturas de equipos (km / horas)', created_at: now, updated_at: now },
      ]);
    }
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT r.id, p.id, NOW() FROM roles r CROSS JOIN permisos p
        WHERE r.nombre = 'Piloto dron' AND r.deleted_at IS NULL AND p.codigo = :c
          AND NOT EXISTS (SELECT 1 FROM rol_permisos rp WHERE rp.role_id = r.id AND rp.permiso_id = p.id)`,
      { replacements: { c: CODIGO } },
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = :c', { replacements: { c: CODIGO } });
    await queryInterface.bulkDelete('permisos', { codigo: CODIGO });
  },
};
