'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('colaboradores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      documento: { type: Sequelize.STRING(30), allowNull: true },
      telefono: { type: Sequelize.STRING(30), allowNull: true },
      finca_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'fincas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      estado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('colaboradores', ['finca_id'], { name: 'idx_colaboradores_finca' });

    // Qué tan bueno es un colaborador (1-5) en cada Labor que sabe hacer —
    // se usa para armar la lista de responsables sugeridos al programar esa
    // labor. Una fila por (colaborador, labor); reemplazo total (destroy +
    // bulkCreate) al editar, mismo patrón que estadios_hoja/hojas_infectadas.
    await queryInterface.createTable('colaborador_labores', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      colaborador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      labor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'labores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      calificacion: { type: Sequelize.INTEGER, allowNull: false },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addConstraint('colaborador_labores', {
      fields: ['colaborador_id', 'labor_id'],
      type: 'unique',
      name: 'uq_colaborador_labor',
    });

    // El "responsable" de una labor programada pasa de ser un Usuario del
    // sistema (con login) a ser un Colaborador (trabajador de campo, sin
    // login) — es un cambio de semántica, no solo de nombre de tabla, así
    // que los responsable_id existentes (que apuntaban a `users`) se limpian
    // en vez de migrarse: no hay forma de mapear un usuario a un colaborador
    // automáticamente.
    await queryInterface.sequelize.query('UPDATE labor_series SET responsable_id = NULL');
    await queryInterface.sequelize.query('UPDATE labor_ocurrencias SET responsable_id = NULL');

    for (const tabla of ['labor_series', 'labor_ocurrencias']) {
      const [fks] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabla}'
           AND COLUMN_NAME = 'responsable_id' AND REFERENCED_TABLE_NAME = 'users'`,
      );
      for (const fk of fks) {
        await queryInterface.sequelize.query(`ALTER TABLE ${tabla} DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      }
      await queryInterface.addConstraint(tabla, {
        fields: ['responsable_id'],
        type: 'foreign key',
        name: `fk_${tabla}_responsable_colaborador`,
        references: { table: 'colaboradores', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const tabla of ['labor_series', 'labor_ocurrencias']) {
      await queryInterface.removeConstraint(tabla, `fk_${tabla}_responsable_colaborador`);
      await queryInterface.sequelize.query(`UPDATE ${tabla} SET responsable_id = NULL`);
      await queryInterface.addConstraint(tabla, {
        fields: ['responsable_id'],
        type: 'foreign key',
        name: `fk_${tabla}_responsable_user`,
        references: { table: 'users', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    await queryInterface.dropTable('colaborador_labores');
    await queryInterface.dropTable('colaboradores');
  },
};
