'use strict';

const crypto = require('node:crypto');

// El botón «Eliminar borrador» del comprobante pasó a «Anular» (el documento
// queda como registro histórico con su motivo y desde él se regenera un
// borrador nuevo). El permiso cambia de código y quien ya podía eliminar pasa
// a poder anular; se retira el permiso viejo para que no quede suelto en la
// matriz de roles (Maestros → Roles).
const CODIGO_NUEVO = 'sanidad_vegetal.comprobantes_aspersion.anular';
const CODIGO_VIEJO = 'sanidad_vegetal.comprobantes_aspersion.eliminar';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { PERMISSIONS_SEED } = await import('../../constants/permissions.constants.js');

    const existentes = await queryInterface.sequelize.query('SELECT codigo FROM permisos WHERE codigo = :codigo', {
      replacements: { codigo: CODIGO_NUEVO },
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (!existentes.length) {
      const p = PERMISSIONS_SEED.find((x) => x.codigo === CODIGO_NUEVO);
      const now = new Date();
      await queryInterface.bulkInsert('permisos', [
        { uuid: crypto.randomUUID(), codigo: p.codigo, nombre: p.nombre, created_at: now, updated_at: now },
      ]);
    }

    // Quien podía eliminar el borrador ahora puede anular (y regenerar).
    await queryInterface.sequelize.query(
      `INSERT INTO rol_permisos (role_id, permiso_id, created_at)
       SELECT DISTINCT rp.role_id, destino.id, NOW()
         FROM rol_permisos rp
         JOIN permisos origen ON origen.id = rp.permiso_id AND origen.codigo = :viejo
         JOIN permisos destino ON destino.codigo = :nuevo
        WHERE NOT EXISTS (SELECT 1 FROM rol_permisos x WHERE x.role_id = rp.role_id AND x.permiso_id = destino.id)`,
      { replacements: { viejo: CODIGO_VIEJO, nuevo: CODIGO_NUEVO } },
    );

    // Se retira el permiso viejo (ya no lo usa ninguna ruta). En una base nueva
    // no existe: los DELETE simplemente no afectan filas.
    await queryInterface.sequelize.query(
      `DELETE rp FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.codigo = :viejo`,
      { replacements: { viejo: CODIGO_VIEJO } },
    );
    await queryInterface.sequelize.query('DELETE FROM permisos WHERE codigo = :viejo', { replacements: { viejo: CODIGO_VIEJO } });
  },

  async down() {
    // Sin reversa: restituir «eliminar» dejaría el botón de borrado (que ya no
    // existe en la API) y perdería las asignaciones de «anular».
  },
};
