'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Paso 1: ampliar el ENUM para admitir ambos valores a la vez.
    await queryInterface.changeColumn('racimo_movimientos', 'tipo', {
      type: Sequelize.ENUM('EMBOLSE', 'REPIQUE', 'RECUSE', 'CORTE', 'PROCESADO'),
      allowNull: false,
    });

    // Paso 2: migrar los datos existentes.
    await queryInterface.sequelize.query(
      "UPDATE racimo_movimientos SET tipo = 'PROCESADO' WHERE tipo = 'CORTE'",
    );

    // Paso 3: angostar el ENUM, quitando el valor viejo.
    await queryInterface.changeColumn('racimo_movimientos', 'tipo', {
      type: Sequelize.ENUM('EMBOLSE', 'REPIQUE', 'RECUSE', 'PROCESADO'),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('racimo_movimientos', 'tipo', {
      type: Sequelize.ENUM('EMBOLSE', 'REPIQUE', 'RECUSE', 'CORTE', 'PROCESADO'),
      allowNull: false,
    });

    await queryInterface.sequelize.query(
      "UPDATE racimo_movimientos SET tipo = 'CORTE' WHERE tipo = 'PROCESADO'",
    );

    await queryInterface.changeColumn('racimo_movimientos', 'tipo', {
      type: Sequelize.ENUM('EMBOLSE', 'REPIQUE', 'RECUSE', 'CORTE'),
      allowNull: false,
    });
  },
};
