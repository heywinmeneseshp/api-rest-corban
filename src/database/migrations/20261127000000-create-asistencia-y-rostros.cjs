'use strict';

// Asistencia por reconocimiento facial. NO se guardan fotos: solo el vector (128 números) de la huella facial de
// cada colaborador, calculado en el dispositivo (celular o navegador) con face-api; el servidor únicamente compara
// vectores. Una marcación solo guarda la distancia (qué tan parecido fue), nunca el vector que se usó.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Autorización del tratamiento del dato biométrico + vínculo opcional con un usuario (marca en su propio celular).
    await queryInterface.addColumn('colaboradores', 'rostro_consentimiento_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('colaboradores', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Una fila por muestra (pose) enrolada: varios ángulos de la misma persona.
    await queryInterface.createTable('colaborador_rostros', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.UUIDV4 },
      colaborador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'colaboradores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pose: { type: Sequelize.STRING(20), allowNull: true },
      // 128 números (JSON). No es una foto y no permite reconstruirla.
      descriptor: { type: Sequelize.JSON, allowNull: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('colaborador_rostros', ['colaborador_id'], { name: 'idx_colab_rostros_colaborador' });

    await queryInterface.createTable('asistencia_marcaciones', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      // Lo genera el móvil: reenviar una marcación (cola offline) no la duplica.
      uuid: { type: Sequelize.UUID, allowNull: false, unique: true },
      colaborador_id: { type: Sequelize.INTEGER, allowNull: false },
      finca_id: { type: Sequelize.INTEGER, allowNull: false },
      tipo: { type: Sequelize.ENUM('ENTRADA', 'SALIDA'), allowNull: false },
      fecha_hora: { type: Sequelize.DATE, allowNull: false },
      lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      // Distancia euclidiana al mejor vector enrolado (menor = más parecido).
      distancia: { type: Sequelize.DECIMAL(6, 4), allowNull: true },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      updated_by: { type: Sequelize.INTEGER, allowNull: true },
      deleted_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('asistencia_marcaciones', ['colaborador_id', 'fecha_hora'], { name: 'idx_asistencia_colab_fecha' });
    await queryInterface.addIndex('asistencia_marcaciones', ['finca_id', 'fecha_hora'], { name: 'idx_asistencia_finca_fecha' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asistencia_marcaciones');
    await queryInterface.dropTable('colaborador_rostros');
    await queryInterface.removeColumn('colaboradores', 'user_id');
    await queryInterface.removeColumn('colaboradores', 'rostro_consentimiento_at');
  },
};
