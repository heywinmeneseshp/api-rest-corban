'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('mezcla_versiones', 'estado_prueba', {
      type: Sequelize.ENUM('BORRADOR', 'EN_PRUEBA', 'OPTIMA', 'NO_VALIDA', 'CONVERTIDA'),
      allowNull: false,
      defaultValue: 'BORRADOR',
    });
    await queryInterface.addColumn('mezcla_versiones', 'ph_final', { type: Sequelize.DECIMAL(4, 2), allowNull: true });
    await queryInterface.addColumn('mezcla_versiones', 'ce_final', { type: Sequelize.DECIMAL(6, 2), allowNull: true });
    // Snapshot de los parámetros de validación vigentes al momento de
    // finalizar la prueba — si después un admin cambia los límites en
    // Configuración, esta prueba histórica conserva con qué se evaluó
    // (ver configuracion.service.js#CLAVE_MEZCLA_PARAMETROS).
    await queryInterface.addColumn('mezcla_versiones', 'parametros_usados', { type: Sequelize.JSON, allowNull: true });
    // Documento (MIX-0001) del movimiento de salida de inventario generado
    // al finalizar — único por versión, es la guardia contra doble
    // descuento si la prueba se vuelve a guardar/editar después.
    await queryInterface.addColumn('mezcla_versiones', 'movimiento_documento', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('mezcla_versiones', 'almacen_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'almacenes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addColumn('mezcla_versiones', 'elaboracion_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'elaboraciones', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_versiones', 'elaboracion_id');
    await queryInterface.removeColumn('mezcla_versiones', 'almacen_id');
    await queryInterface.removeColumn('mezcla_versiones', 'movimiento_documento');
    await queryInterface.removeColumn('mezcla_versiones', 'parametros_usados');
    await queryInterface.removeColumn('mezcla_versiones', 'ce_final');
    await queryInterface.removeColumn('mezcla_versiones', 'ph_final');
    await queryInterface.removeColumn('mezcla_versiones', 'estado_prueba');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_mezcla_versiones_estado_prueba\";").catch(() => {});
  },
};
