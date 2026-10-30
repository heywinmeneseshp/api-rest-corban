'use strict';

const crypto = require('node:crypto');

// Permiso «Marcar aspersiones como revisadas» (su firma sale en el aviso). Lo reciben los roles que ya pueden editar
// programaciones de aspersión; se ajusta en Maestros → Roles.
const CODIGO = 'sanidad_vegetal.aspersiones.revisar';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');
    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos WHERE codigo = :codigo', {
      replacements: { codigo: CODIGO },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (!existentes.length) {
      const p = PERMISSIONS_SEED.find((x) => x.codigo === CODIGO);
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [{ uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now }]);
    }
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT DISTINCT rp.role_id, destino.id, NOW()
         FROM rol_permisos rp
         JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = 'sanidad_vegetal.aspersiones.editar'
         JOIN permisos destino ON destino.codigo = :codigo
        WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
      { replacements: { codigo: CODIGO } },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permisos', { codigo: [CODIGO] });
  },
};
