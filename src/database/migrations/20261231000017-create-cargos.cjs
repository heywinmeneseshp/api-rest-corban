'use strict';

// Maestro de cargos (Maestros → Cargos): etiquetas que se asignan a usuarios y colaboradores (uno por persona). Se conserva la
// columna de texto `cargo` como copia del nombre (la usan las firmas de los documentos); `cargo_id` es la referencia.
// Carga inicial: una etiqueta por cada cargo distinto que ya estaba escrito (sin distinguir mayúsculas, tildes ni espacios
// repetidos; se toma la escritura más usada) y se asigna a cada usuario y colaborador.
const clave = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cargos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.STRING(300), allowNull: true },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    for (const tabla of ['users', 'colaboradores']) {
      await queryInterface.addColumn(tabla, 'cargo_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'cargos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT });
    const filas = [
      ...(await q("SELECT cargo, COUNT(*) n FROM users WHERE cargo IS NOT NULL AND TRIM(cargo) <> '' GROUP BY cargo")),
      ...(await q("SELECT cargo, COUNT(*) n FROM colaboradores WHERE cargo IS NOT NULL AND TRIM(cargo) <> '' GROUP BY cargo")),
    ];
    // Por cada clave, la escritura más usada.
    const grupos = new Map();
    for (const f of filas) {
      const k = clave(f.cargo);
      if (!k) continue;
      const g = grupos.get(k) || new Map();
      g.set(limpio(f.cargo), (g.get(limpio(f.cargo)) || 0) + Number(f.n));
      grupos.set(k, g);
    }
    const now = new Date();
    const crypto = require('node:crypto');
    for (const [k, escrituras] of grupos) {
      const nombre = [...escrituras.entries()].sort((a, b) => b[1] - a[1])[0][0];
      await queryInterface.bulkInsert('cargos', [{ uuid: crypto.randomUUID(), nombre, estado: true, created_at: now, updated_at: now }]);
      const [{ id }] = await q('SELECT id FROM cargos WHERE nombre = :nombre ORDER BY id DESC LIMIT 1', { nombre });
      for (const tabla of ['users', 'colaboradores']) {
        const conEseCargo = await q(`SELECT id, cargo FROM ${tabla} WHERE cargo IS NOT NULL`);
        const ids = conEseCargo.filter((r) => clave(r.cargo) === k).map((r) => r.id);
        if (ids.length) {
          await queryInterface.sequelize.query(`UPDATE ${tabla} SET cargo_id = :id, cargo = :nombre WHERE id IN (:ids)`, { replacements: { id, nombre, ids } });
        }
      }
    }
  },

  async down(queryInterface) {
    for (const tabla of ['users', 'colaboradores']) {
      const [fks] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = 'cargo_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { replacements: { t: tabla } },
      );
      for (const fk of fks) await queryInterface.removeConstraint(tabla, fk.CONSTRAINT_NAME);
      await queryInterface.removeColumn(tabla, 'cargo_id');
    }
    await queryInterface.dropTable('cargos');
  },
};
