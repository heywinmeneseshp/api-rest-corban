'use strict';

// Marca cuándo una finca "liquida" (da por cerrado el registro de
// movimientos de racimos de) una semana puntual. Se usa para saber qué
// semanas ya están "cerradas" y así calcular el Patrón de corte sobre datos
// completos, no parciales — y (desde el mismo día que se creó esta tabla)
// bloquea de verdad crear/editar/eliminar movimientos de racimos de una
// semana liquidada (salvo Administrador), ver
// racimoMovimiento.service.js `assertSemanaNoLiquidada`.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('finca_semana_liquidaciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, unique: true },
      finca_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'fincas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      semana_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'semanas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      liquidada_en: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addConstraint('finca_semana_liquidaciones', {
      fields: ['finca_id', 'semana_id'],
      type: 'unique',
      name: 'uniq_finca_semana_liquidacion',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('finca_semana_liquidaciones');
  },
};
