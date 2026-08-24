'use strict';

// precipitacion_diaria y precipitacion_diaria_config se crearon con SQL
// crudo (ver ensureTables() en precipitacionDiaria.service.js), sin llaves
// foráneas reales hacia fincas/roles/semanas/users — solo columnas *_id
// sueltas + nombre copiado a mano en cada insert. Se le agregan las FK que
// le faltaban para poder hacer JOIN real en vez de una consulta aparte por
// cada nombre (ver precipitacionDiariaModels.js para los modelos Sequelize
// que las usan). Datos existentes ya verificados sin huérfanos antes de
// escribir esto.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Si las tablas aún no existen (se crean lazily por ensureTables() del
    // service), no hay FK que agregar — se marca como hecha y el service las
    // creará con el esquema correcto en el primer uso.
    const tablas = await queryInterface.showAllTables();
    const normaliza = (t) => String(t).toLowerCase();
    if (!tablas.map(normaliza).includes('precipitacion_diaria_config') || !tablas.map(normaliza).includes('precipitacion_diaria')) {
      return;
    }

    // semana_inicio_uuid quedó como VARCHAR(36)/utf8mb4 pero semanas.uuid es
    // CHAR(36)/latin1_bin (columna vieja, inconsistente con el resto del
    // esquema) — MySQL exige mismo tipo y charset para poder crear la FK.
    await queryInterface.sequelize.query(
      "ALTER TABLE precipitacion_diaria_config MODIFY semana_inicio_uuid CHAR(36) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL",
    );

    await queryInterface.addConstraint('precipitacion_diaria_config', {
      fields: ['finca_id'],
      type: 'foreign key',
      name: 'fk_precip_config_finca',
      references: { table: 'fincas', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addConstraint('precipitacion_diaria_config', {
      fields: ['rol_id'],
      type: 'foreign key',
      name: 'fk_precip_config_rol',
      references: { table: 'roles', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addConstraint('precipitacion_diaria_config', {
      fields: ['semana_inicio_uuid'],
      type: 'foreign key',
      name: 'fk_precip_config_semana',
      references: { table: 'semanas', field: 'uuid' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addConstraint('precipitacion_diaria', {
      fields: ['finca_id'],
      type: 'foreign key',
      name: 'fk_precip_registro_finca',
      references: { table: 'fincas', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addConstraint('precipitacion_diaria', {
      fields: ['usuario_id'],
      type: 'foreign key',
      name: 'fk_precip_registro_usuario',
      references: { table: 'users', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('precipitacion_diaria', 'fk_precip_registro_usuario');
    await queryInterface.removeConstraint('precipitacion_diaria', 'fk_precip_registro_finca');
    await queryInterface.removeConstraint('precipitacion_diaria_config', 'fk_precip_config_semana');
    await queryInterface.removeConstraint('precipitacion_diaria_config', 'fk_precip_config_rol');
    await queryInterface.removeConstraint('precipitacion_diaria_config', 'fk_precip_config_finca');
    await queryInterface.sequelize.query(
      "ALTER TABLE precipitacion_diaria_config MODIFY semana_inicio_uuid VARCHAR(36) CHARACTER SET utf8mb4 NOT NULL",
    );
  },
};
