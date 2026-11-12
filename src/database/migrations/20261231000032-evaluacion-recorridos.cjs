'use strict';

// Recorrido (traza GPS) del evaluador mientras hace evaluaciones: un recorrido por finca, que el usuario inicia y termina desde la app móvil.
// Los puntos se guardan cada ~15 s o ~15 m; el único (recorrido_id, registrado_at) hace idempotente el reenvío de la cola offline.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('evaluacion_recorridos', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      usuario_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
      finca_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fincas', key: 'id' } },
      inicio: { type: Sequelize.DATE(3), allowNull: false },
      fin: { type: Sequelize.DATE(3), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('evaluacion_recorridos', ['usuario_id', 'inicio']);
    await queryInterface.addIndex('evaluacion_recorridos', ['finca_id', 'inicio']);
    await queryInterface.createTable('evaluacion_recorrido_puntos', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      recorrido_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'evaluacion_recorridos', key: 'id' }, onDelete: 'CASCADE' },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      precision_m: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      registrado_at: { type: Sequelize.DATE(3), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('evaluacion_recorrido_puntos', ['recorrido_id', 'registrado_at'], { unique: true, name: 'uq_eval_recorrido_punto_momento' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('evaluacion_recorrido_puntos');
    await queryInterface.dropTable('evaluacion_recorridos');
  },
};
