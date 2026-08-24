'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`precipitacion_diaria_config\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        finca_id INT NOT NULL,
        finca_uuid VARCHAR(36) NOT NULL,
        finca_nombre VARCHAR(255),
        rol_id INT NOT NULL,
        rol_nombre VARCHAR(100),
        semana_inicio_uuid VARCHAR(36) NOT NULL,
        semana_inicio_codigo VARCHAR(20),
        fecha_inicio DATE NOT NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        creado_por_nombre VARCHAR(255),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`precipitacion_diaria\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        finca_id INT NOT NULL,
        finca_uuid VARCHAR(36) NOT NULL,
        finca_nombre VARCHAR(255),
        fecha DATE NOT NULL,
        mm DECIMAL(8,2) NOT NULL,
        usuario_id INT NULL,
        usuario_nombre VARCHAR(255),
        coincide_clima TINYINT(1) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_finca_fecha (finca_id, fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('precipitacion_diaria');
    await queryInterface.dropTable('precipitacion_diaria_config');
  },
};
