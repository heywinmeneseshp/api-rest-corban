'use strict';

// Anulación de comprobantes de aspersión (reemplaza el borrado).
//
// Antes: un borrador se eliminaba (soft delete) y la aspersión quedaba
// ejecutada pero SIN comprobante para siempre — no había forma de regenerarlo
// y las alertas FRAC (fracLimite.service.js) perdían el dato de la aeronave.
//
// Ahora: el comprobante se ANULA (queda el registro, con motivo y responsables)
// y desde uno anulado se puede regenerar un borrador nuevo con los mismos
// datos de la aplicación. Por eso una aspersión puede tener varios
// comprobantes: uno vigente (BORRADOR o EMITIDO) y N anulados. El UNIQUE de
// aspersion_programacion_id se cambia por un índice normal (la regla
// "un solo vigente" se valida en comprobanteAspersion.service.js).

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = 'comprobantes_aspersion';

    // 1) Nuevo estado ANULADO.
    await queryInterface.changeColumn(t, 'estado', {
      type: Sequelize.ENUM('BORRADOR', 'EMITIDO', 'ANULADO'),
      allowNull: false,
      defaultValue: 'BORRADOR',
    });

    // 2) Datos de la anulación (quién, cuándo y por qué).
    await queryInterface.addColumn(t, 'motivo_anulacion', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn(t, 'anulado_por_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    });
    await queryInterface.addColumn(t, 'anulado_en', { type: Sequelize.DATE, allowNull: true });

    // 3) Varios comprobantes por aspersión: índice normal en vez de UNIQUE.
    //    El índice normal se crea ANTES de soltar el único porque la FK de
    //    aspersion_programacion_id usa ese índice y MySQL no permite dejar la
    //    columna sin ningún índice. El nombre del índice único lo pone cada
    //    motor (según versión de Sequelize), así que se resuelve por SHOW INDEX.
    const [indexes] = await queryInterface.sequelize.query(`SHOW INDEX FROM ${t};`);
    const deLaColumna = indexes.filter((i) => i.Column_name === 'aspersion_programacion_id');
    const unico = deLaColumna.find((i) => Number(i.Non_unique) === 0);
    const normal = deLaColumna.find((i) => Number(i.Non_unique) === 1);

    if (!normal) {
      await queryInterface.addIndex(t, ['aspersion_programacion_id'], { name: 'idx_comprobantes_aspersion_aspersion' });
    }
    if (unico) {
      await queryInterface.sequelize.query(`ALTER TABLE ${t} DROP INDEX \`${unico.Key_name}\`;`);
    }
  },

  async down(queryInterface, Sequelize) {
    const t = 'comprobantes_aspersion';

    // La reversa solo es posible si no hay aspersiones con más de un
    // comprobante (el UNIQUE no lo permitiría). Si las hay, se deja el
    // esquema como está para no perder registros de anulación.
    const [duplicadas] = await queryInterface.sequelize.query(
      `SELECT aspersion_programacion_id FROM ${t} GROUP BY aspersion_programacion_id HAVING COUNT(*) > 1 LIMIT 1;`,
    );
    if (!duplicadas.length) {
      const [indexes] = await queryInterface.sequelize.query(`SHOW INDEX FROM ${t};`);
      const deLaColumna = indexes.filter((i) => i.Column_name === 'aspersion_programacion_id');
      if (!deLaColumna.some((i) => Number(i.Non_unique) === 0)) {
        await queryInterface.sequelize.query(`ALTER TABLE ${t} ADD UNIQUE INDEX \`aspersion_programacion_id\` (aspersion_programacion_id);`);
      }
      if (deLaColumna.some((i) => i.Key_name === 'idx_comprobantes_aspersion_aspersion')) {
        await queryInterface.removeIndex(t, 'idx_comprobantes_aspersion_aspersion');
      }
    }

    // El estado ANULADO no existe en el esquema anterior: se devuelven esos
    // comprobantes a BORRADOR (la anulación se pierde; es una reversa).
    await queryInterface.sequelize.query(`UPDATE ${t} SET estado = 'BORRADOR' WHERE estado = 'ANULADO';`);
    await queryInterface.changeColumn(t, 'estado', {
      type: Sequelize.ENUM('BORRADOR', 'EMITIDO'),
      allowNull: false,
      defaultValue: 'BORRADOR',
    });

    // anulado_por_id tiene FK a users: MySQL no deja borrar la columna con la
    // restricción viva, así que se quita primero (el nombre lo pone el motor).
    const [fks] = await queryInterface.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = 'anulado_por_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL;`,
      { replacements: { t } },
    );
    for (const fk of fks) {
      await queryInterface.removeConstraint(t, fk.CONSTRAINT_NAME);
    }

    await queryInterface.removeColumn(t, 'anulado_en');
    await queryInterface.removeColumn(t, 'anulado_por_id');
    await queryInterface.removeColumn(t, 'motivo_anulacion');
  },
};
