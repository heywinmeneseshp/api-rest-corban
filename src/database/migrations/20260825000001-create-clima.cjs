'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabla clima — antes creada al vuelo por ensureTable() en clima.service.js
    // Se formaliza aquí para que quede versionada en SequelizeMeta y no dependa de runtime.
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`clima\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        finca_uuid VARCHAR(36) NOT NULL,
        finca_nombre VARCHAR(255),
        semana_uuid VARCHAR(36) NOT NULL,
        semana_codigo VARCHAR(20),
        fecha DATE NOT NULL,
        mm DECIMAL(8,2) NULL,
        temperatura DECIMAL(5,2) NULL,
        humedad_relativa DECIMAL(5,2) NULL,
        usuario_nombre VARCHAR(255),
        usuario_uuid VARCHAR(36),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_finca_fecha (finca_uuid, fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migra datos de tabla vieja si existe
    const [[existeAnterior]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'precipitaciones'`,
    );
    if (Number(existeAnterior.c) > 0) {
      const [[existeNueva]] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'clima'`,
      );
      // Si clima estaba vacía y precipitaciones tenía datos, renombrar ya no aplica
      // porque arriba se creó clima vacía — en ese caso se copian los datos
      const [[countClima]] = await queryInterface.sequelize.query(`SELECT COUNT(*) AS c FROM \`clima\``);
      const [[countAnterior]] = await queryInterface.sequelize.query(`SELECT COUNT(*) AS c FROM \`precipitaciones\``);
      if (Number(countClima.c) === 0 && Number(countAnterior.c) > 0) {
        await queryInterface.sequelize.query(`INSERT INTO \`clima\` (uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm, usuario_nombre, usuario_uuid, created_at) SELECT uuid, finca_uuid, finca_nombre, semana_uuid, semana_codigo, fecha, mm, usuario_nombre, usuario_uuid, created_at FROM \`precipitaciones\``);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clima');
  },
};
