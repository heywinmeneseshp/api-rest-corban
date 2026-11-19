'use strict';

// Notificaciones push de la app móvil: token de Expo de cada celular (por usuario) y permiso para recibir las de comprobantes
// de aspersión (se activa por rol; de entrada lo tiene «Director de Sanidad»).
const crypto = require('node:crypto');
const CODIGO = 'sanidad_vegetal.comprobantes_aspersion.notificar';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tablas.includes('push_tokens')) {
      await queryInterface.createTable('push_tokens', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        token: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        plataforma: { type: Sequelize.STRING(20), allowNull: true },
        // El usuario puede silenciar las notificaciones en su celular sin perder el permiso.
        activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }
    const [existe] = await queryInterface.sequelize.query('SELECT id FROM permisos WHERE codigo = :c', { replacements: { c: CODIGO } });
    if (!existe.length) {
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [
        {
          uuid: crypto.randomUUID(),
          codigo: CODIGO,
          nombre: 'Recibir notificaciones en la app móvil de comprobantes de aspersión (nuevo comprobante y KML)',
          created_at: now,
          updated_at: now,
        },
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
    await queryInterface.dropTable('push_tokens');
  },
};
