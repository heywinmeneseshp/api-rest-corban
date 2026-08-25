'use strict';

// Renombra `mezcla_versiones.creada_por` a `created_by` para que coincida con la
// convención del resto de las tablas de auditoría (created_by/updated_by/deleted_by).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint('mezcla_versiones', 'fk_mezcla_versiones_creada_por');
    await queryInterface.renameColumn('mezcla_versiones', 'creada_por', 'created_by');
    await queryInterface.addConstraint('mezcla_versiones', {
      fields: ['created_by'],
      type: 'foreign key',
      name: 'fk_mezcla_versiones_created_by',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('mezcla_versiones', 'fk_mezcla_versiones_created_by');
    await queryInterface.renameColumn('mezcla_versiones', 'created_by', 'creada_por');
    await queryInterface.addConstraint('mezcla_versiones', {
      fields: ['creada_por'],
      type: 'foreign key',
      name: 'fk_mezcla_versiones_creada_por',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
};
