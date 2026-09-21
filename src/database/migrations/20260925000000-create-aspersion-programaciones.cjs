'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dosis por hectárea de la mezcla (en la misma unidad de su
    // unidadRendimiento, ej. "6 gls/ha") — la usa Programación de
    // Aspersiones para calcular la cantidad total a preparar
    // (cantidad = dosisPorHectarea × hectáreas). Nullable: una mezcla vieja
    // o una que nunca se usa en aspersiones no necesita tenerla configurada.
    await queryInterface.addColumn('mezclas', 'dosis_por_hectarea', {
      type: Sequelize.DECIMAL(12, 4),
      allowNull: true,
    });

    await queryInterface.createTable('aspersion_programaciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      numero: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      finca_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'fincas', key: 'id' } },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      // Semana en la que cae `fecha` — resuelta contra la tabla `semanas`
      // (mismo criterio que el resto del módulo agrícola, ver
      // semanaRepository.findByFecha). Nullable: si esa fecha todavía no
      // tiene semana generada (Configuración → Semanas), la programación no
      // se bloquea, solo queda sin semana asignada.
      semana_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'semanas', key: 'id' } },
      tipo: {
        type: Sequelize.ENUM('SIGATOKA_NEGRA', 'DEFOLIADOR', 'FERTILIZACION'),
        allowNull: false,
        defaultValue: 'SIGATOKA_NEGRA',
      },
      mezcla_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'mezclas', key: 'id' } },
      almacen_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'almacenes', key: 'id' } },
      hectareas: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      // Snapshot de dosisPorHectarea × hectareas al momento de programar —
      // se vuelve a recalcular con la dosis VIGENTE al ejecutar (por si
      // cambió entre medio), este campo es solo lo que se muestra en el
      // aviso al programar.
      cantidad_calculada: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      estado: {
        type: Sequelize.ENUM('PROGRAMADA', 'EJECUTADA', 'CANCELADA'),
        allowNull: false,
        defaultValue: 'PROGRAMADA',
      },
      fecha_ejecucion: { type: Sequelize.DATEONLY, allowNull: true },
      // Documento del movimiento de salida de inventario generado al
      // ejecutar — guardia contra doble descuento (mismo patrón que
      // mezcla_versiones.movimiento_documento).
      movimiento_documento: { type: Sequelize.STRING(50), allowNull: true, unique: true },
      representante_corbana_nombre: { type: Sequelize.STRING(150), allowNull: true },
      administrador_finca_nombre: { type: Sequelize.STRING(150), allowNull: true },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      usuario_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aspersion_programaciones');
    await queryInterface.removeColumn('mezclas', 'dosis_por_hectarea');
  },
};
