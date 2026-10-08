'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    // Catálogo de códigos FRAC (con modo de acción y el límite de aplicaciones por finca en 12 meses).
    await queryInterface.createTable('frac_codigos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.literal('(UUID())') },
      codigo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      modo_accion: { type: Sequelize.STRING(255), allowNull: true },
      max_aplicaciones: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    // Catálogo de grupos químicos: cada uno pertenece a UN código FRAC.
    await queryInterface.createTable('grupos_quimicos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.literal('(UUID())') },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      frac_codigo_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'frac_codigos', key: 'id' } },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await queryInterface.addIndex('grupos_quimicos', ['frac_codigo_id', 'nombre'], { unique: true, name: 'uq_grupos_quimicos_frac_nombre' });

    // Datos que ya estaban "quemados" en la fila del ingrediente → a sus tablas.
    await q(`
      INSERT INTO frac_codigos (uuid, codigo, modo_accion, max_aplicaciones)
      SELECT UUID(), t.codigo, t.modo_accion, l.max_aplicaciones FROM (
        SELECT frac_codigo AS codigo, MIN(modo_accion) AS modo_accion FROM ingredientes_activos
         WHERE frac_codigo IS NOT NULL AND frac_codigo <> '' GROUP BY frac_codigo
      ) t LEFT JOIN frac_limites l ON CONVERT(l.frac_codigo USING utf8mb4) COLLATE utf8mb4_unicode_ci = t.codigo COLLATE utf8mb4_unicode_ci
    `);
    await q(`
      INSERT INTO grupos_quimicos (uuid, nombre, frac_codigo_id)
      SELECT UUID(), t.grupo_quimico, fc.id FROM (
        SELECT DISTINCT frac_codigo, grupo_quimico FROM ingredientes_activos
         WHERE frac_codigo IS NOT NULL AND frac_codigo <> '' AND grupo_quimico IS NOT NULL AND grupo_quimico <> ''
      ) t JOIN frac_codigos fc ON fc.codigo = t.frac_codigo
    `);

    await queryInterface.addColumn('ingredientes_activos', 'grupo_quimico_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'grupos_quimicos', key: 'id' },
    });
    await q(`
      UPDATE ingredientes_activos ia
        JOIN frac_codigos fc ON fc.codigo = ia.frac_codigo
        JOIN grupos_quimicos g ON g.frac_codigo_id = fc.id AND g.nombre = ia.grupo_quimico
         SET ia.grupo_quimico_id = g.id
    `);

    await queryInterface.removeColumn('ingredientes_activos', 'frac_codigo');
    await queryInterface.removeColumn('ingredientes_activos', 'grupo_quimico');
    await queryInterface.removeColumn('ingredientes_activos', 'modo_accion');
    await queryInterface.dropTable('frac_limites');
  },

  async down(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await queryInterface.createTable('frac_limites', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.literal('(UUID())') },
      frac_codigo: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      max_aplicaciones: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addColumn('ingredientes_activos', 'frac_codigo', { type: Sequelize.STRING(10), allowNull: true });
    await queryInterface.addColumn('ingredientes_activos', 'grupo_quimico', { type: Sequelize.STRING(150), allowNull: true });
    await queryInterface.addColumn('ingredientes_activos', 'modo_accion', { type: Sequelize.STRING(255), allowNull: true });
    await q(`
      UPDATE ingredientes_activos ia
        JOIN grupos_quimicos g ON g.id = ia.grupo_quimico_id
        JOIN frac_codigos fc ON fc.id = g.frac_codigo_id
         SET ia.frac_codigo = fc.codigo, ia.grupo_quimico = g.nombre, ia.modo_accion = fc.modo_accion
    `);
    await q('INSERT INTO frac_limites (uuid, frac_codigo, max_aplicaciones) SELECT UUID(), codigo, max_aplicaciones FROM frac_codigos');
    await queryInterface.removeColumn('ingredientes_activos', 'grupo_quimico_id');
    await queryInterface.dropTable('grupos_quimicos');
    await queryInterface.dropTable('frac_codigos');
  },
};
