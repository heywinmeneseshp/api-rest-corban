'use strict';

// Aprobación de mezclas: después de "Crear elaborado", la prueba queda en
// PENDIENTE_APROBACION y el artículo elaborado nace INACTIVO (no usable)
// hasta que un usuario de un rol autorizado (Configuración → Parámetros de
// Mezcla) la apruebe → pasa a CONVERTIDA y el artículo se activa.
// Se guardan fecha/hora y usuario tanto de la finalización de la prueba
// como de la aprobación.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE mezcla_versiones MODIFY COLUMN estado_prueba " +
        "ENUM('BORRADOR','EN_PRUEBA','OPTIMA','NO_VALIDA','PENDIENTE_APROBACION','CONVERTIDA') " +
        "NOT NULL DEFAULT 'BORRADOR'",
    );

    await queryInterface.addColumn('mezcla_versiones', 'finalizada_en', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('mezcla_versiones', 'finalizada_por', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('mezcla_versiones', 'aprobada_en', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('mezcla_versiones', 'aprobada_por', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    // Datos de "Crear elaborado" (cantidad, almacén, fecha, observaciones)
    // guardados a la espera de la aprobación: la Elaboración y su entrada de
    // inventario NO se generan hasta que se aprueba (ver aprobar()).
    await queryInterface.addColumn('mezcla_versiones', 'elaborado_payload', { type: Sequelize.JSON, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('mezcla_versiones', 'elaborado_payload');
    await queryInterface.removeColumn('mezcla_versiones', 'aprobada_por');
    await queryInterface.removeColumn('mezcla_versiones', 'aprobada_en');
    await queryInterface.removeColumn('mezcla_versiones', 'finalizada_por');
    await queryInterface.removeColumn('mezcla_versiones', 'finalizada_en');
    // Nota: no se revierte el ENUM (dejar el valor extra es inocuo).
  },
};
