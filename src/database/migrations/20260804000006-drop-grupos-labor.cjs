'use strict';

// Limpieza: `grupos_labor` quedó huérfana cuando se renombró la migración
// original a `categorias_labor` (sequelize-cli la trató como una migración
// nueva y volvió a correr la creación de tabla bajo el nombre viejo). Además,
// en bases que ya tenían la estructura vieja, `labores.grupo_labor_id` seguía
// con su FK hacia `grupos_labor`, bloqueando el drop. Esta migración:
//   1. suelta esa FK y migra `labores` a `categoria_labor_id`,
//   2. elimina `grupos_labor`.
// Es idempotente: si la columna/FK ya no existen (BD local ya actualizada),
// no hace nada.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const dbName = process.env.DB_NAME;

    // Si la BD quedó con la estructura vieja, `labores` tiene grupo_labor_id.
    const [grupoCols] = await sequelize.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'labores' AND COLUMN_NAME = 'grupo_labor_id'",
      { replacements: [dbName] },
    );

    if (grupoCols.length > 0) {
      // Suelta la FK vieja (puede llamarse distinto en cada BD).
      try {
        await queryInterface.removeConstraint('labores', 'labores_ibfk_1');
      } catch {
        // Si se llama distinto, la buscamos por nombre.
        const [fks] = await sequelize.query(
          "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'labores' AND COLUMN_NAME = 'grupo_labor_id' AND REFERENCED_TABLE_NAME = 'grupos_labor'",
          { replacements: [dbName] },
        );
        for (const fk of fks) {
          await queryInterface.removeConstraint('labores', fk.CONSTRAINT_NAME);
        }
      }

      // Renombra la columna a la estructura nueva.
      await queryInterface.renameColumn('labores', 'grupo_labor_id', 'categoria_labor_id');

      // Recrea la constraint hacia categorias_labor (idem migración create-labores).
      await queryInterface.changeColumn('labores', 'categoria_labor_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
      await queryInterface.addConstraint('labores', {
        type: 'FOREIGN KEY',
        fields: ['categoria_labor_id'],
        references: { table: 'categorias_labor', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        name: 'labores_categoria_labor_id_fk',
      });
    }

    if (await queryInterface.tableExists('grupos_labor')) {
      await queryInterface.dropTable('grupos_labor');
    }
  },

  async down(queryInterface, Sequelize) {
    // No restauramos la estructura vieja intencionalmente: es una limpieza
    // irreversible. El down solo recrea la tabla vacía vacía.
    await queryInterface.createTable('grupos_labor', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      updated_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },
};