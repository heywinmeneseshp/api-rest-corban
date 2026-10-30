'use strict';

// Pilotos de dron y asistentes de cada comprobante de aspersión (se les paga por hectárea asperjada): el piloto se elige del
// listado de colaboradores (cargo «Piloto de Dron») y los asistentes también. Cada participante suma las hectáreas aplicadas.
// Carga histórica: el piloto escrito a mano en los comprobantes de dron se relaciona con su colaborador; si no existe, se crea
// como colaborador de Sanidad Vegetal con cargo «Piloto de Dron». Si el texto trae varias personas («A - B», «A / B», «A, B»,
// «A y B»), la primera queda como piloto y las demás como asistentes.
const crypto = require('node:crypto');

const CARGO_PILOTO = 'Piloto de Dron';
const clave = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const capitalizar = (t) =>
  String(t || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, esp, letra) => esp + letra.toUpperCase());

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('comprobantes_aspersion', 'piloto_colaborador_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'colaboradores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.createTable('comprobante_aspersion_participantes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      comprobante_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'comprobantes_aspersion', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      colaborador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      rol: { type: Sequelize.ENUM('PILOTO', 'ASISTENTE'), allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('comprobante_aspersion_participantes', ['comprobante_id', 'colaborador_id'], {
      unique: true,
      name: 'uq_participante_comprobante_colaborador',
    });
    await queryInterface.addIndex('comprobante_aspersion_participantes', ['colaborador_id'], { name: 'idx_participante_colaborador' });

    const q = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT });
    const ejecutar = (sql, replacements) => queryInterface.sequelize.query(sql, { replacements });
    const now = new Date();

    // Cargo «Piloto de Dron» en el maestro.
    const cargos = await q('SELECT id, nombre FROM cargos WHERE deleted_at IS NULL');
    let cargoPiloto = cargos.find((c) => clave(c.nombre) === clave(CARGO_PILOTO));
    if (!cargoPiloto) {
      await queryInterface.bulkInsert('cargos', [{ uuid: crypto.randomUUID(), nombre: CARGO_PILOTO, estado: true, created_at: now, updated_at: now }]);
      [cargoPiloto] = await q('SELECT id, nombre FROM cargos WHERE nombre = :n AND deleted_at IS NULL ORDER BY id DESC LIMIT 1', { n: CARGO_PILOTO });
    }

    // Carga histórica: pilotos escritos en comprobantes de dron.
    const comprobantes = await q(
      "SELECT id, piloto FROM comprobantes_aspersion WHERE medio = 'DRON' AND piloto IS NOT NULL AND TRIM(piloto) <> '' AND deleted_at IS NULL",
    );
    if (!comprobantes.length) return;
    const colaboradores = await q('SELECT id, nombre, apellido, cargo_id FROM colaboradores WHERE deleted_at IS NULL');
    const porNombre = new Map();
    for (const c of colaboradores) {
      const k = clave(`${c.nombre} ${c.apellido || ''}`);
      if (k && !porNombre.has(k)) porNombre.set(k, c);
    }
    let vinculados = 0;
    let creados = 0;
    // Colaborador para un nombre escrito: el existente (mismo nombre normalizado) o uno nuevo de Sanidad Vegetal.
    const colaboradorDe = async (texto, { esPiloto }) => {
      const k = clave(texto);
      let colab = porNombre.get(k);
      if (!colab) {
        const partes = capitalizar(texto).split(' ');
        const nombre = partes.shift();
        const apellido = partes.join(' ') || null;
        await queryInterface.bulkInsert('colaboradores', [
          {
            uuid: crypto.randomUUID(),
            nombre,
            apellido,
            cargo: esPiloto ? cargoPiloto.nombre : null,
            cargo_id: esPiloto ? cargoPiloto.id : null,
            modulo: 'SANIDAD_VEGETAL',
            estado: true,
            created_at: now,
            updated_at: now,
          },
        ]);
        [colab] = await q('SELECT id, nombre, apellido, cargo_id FROM colaboradores WHERE nombre = :n AND (apellido <=> :a) ORDER BY id DESC LIMIT 1', {
          n: nombre,
          a: apellido,
        });
        porNombre.set(k, colab);
        creados += 1;
      } else {
        if (esPiloto && !colab.cargo_id) {
          await ejecutar('UPDATE colaboradores SET cargo_id = :c, cargo = :n WHERE id = :id', { c: cargoPiloto.id, n: cargoPiloto.nombre, id: colab.id });
          colab.cargo_id = cargoPiloto.id;
        }
        vinculados += 1;
      }
      return colab;
    };
    for (const comp of comprobantes) {
      const nombres = String(comp.piloto)
        .split(/\s+-\s+|\s*[\/,;&+]\s*|\s+y\s+/i)
        .map((t) => t.trim())
        .filter(Boolean);
      if (!nombres.length) continue;
      const piloto = await colaboradorDe(nombres[0], { esPiloto: true });
      const nombreCompleto = `${piloto.nombre} ${piloto.apellido || ''}`.trim();
      await ejecutar('UPDATE comprobantes_aspersion SET piloto_colaborador_id = :c, piloto = :n WHERE id = :id', { c: piloto.id, n: nombreCompleto, id: comp.id });
      const filas = [{ uuid: crypto.randomUUID(), comprobante_id: comp.id, colaborador_id: piloto.id, rol: 'PILOTO', created_at: now, updated_at: now }];
      for (const otro of nombres.slice(1)) {
        const asistente = await colaboradorDe(otro, { esPiloto: false });
        if (filas.some((f) => f.colaborador_id === asistente.id)) continue;
        filas.push({ uuid: crypto.randomUUID(), comprobante_id: comp.id, colaborador_id: asistente.id, rol: 'ASISTENTE', created_at: now, updated_at: now });
      }
      await queryInterface.bulkInsert('comprobante_aspersion_participantes', filas);
    }
    console.log(`[participantes-comprobante] comprobantes de dron: ${comprobantes.length} · vinculados a colaborador existente: ${vinculados} · pilotos creados: ${creados}`);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('comprobante_aspersion_participantes');
    const [fks] = await queryInterface.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comprobantes_aspersion' AND COLUMN_NAME = 'piloto_colaborador_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
    );
    for (const fk of fks) await queryInterface.removeConstraint('comprobantes_aspersion', fk.CONSTRAINT_NAME);
    await queryInterface.removeColumn('comprobantes_aspersion', 'piloto_colaborador_id');
  },
};
