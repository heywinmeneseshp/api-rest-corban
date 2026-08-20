'use strict';

// Reemplaza el "responsable" (un Colaborador puntual) de una labor
// programada por un número de colaboradores requeridos — el objetivo ya no
// es asignar a alguien específico al programar, sino cuántas personas hacen
// falta, para más adelante hacer un pre-reparto de colaboradores según sus
// habilidades/calificación en esa labor (ver colaborador_labores).
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const tabla of ['labor_series', 'labor_ocurrencias']) {
      // Buscar el nombre real de la FK responsable_id -> colaboradores para
      // poder tirarla antes de borrar la columna (varía según cómo la haya
      // nombrado MySQL al crearla).
      const [fila] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabla}'
           AND COLUMN_NAME = 'responsable_id' AND REFERENCED_TABLE_NAME IS NOT NULL`,
      );
      if (fila[0]?.CONSTRAINT_NAME) {
        await queryInterface.removeConstraint(tabla, fila[0].CONSTRAINT_NAME);
      }
      await queryInterface.removeColumn(tabla, 'responsable_id');
      await queryInterface.addColumn(tabla, 'numero_colaboradores', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const tabla of ['labor_series', 'labor_ocurrencias']) {
      await queryInterface.removeColumn(tabla, 'numero_colaboradores');
      await queryInterface.addColumn(tabla, 'responsable_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'colaboradores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },
};
