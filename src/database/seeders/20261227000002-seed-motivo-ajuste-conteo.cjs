'use strict';

const crypto = require('node:crypto');

// Motivo de ajuste por defecto para los conteos de inventario (se puede elegir otro al cerrar el conteo).
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const existe = await queryInterface.sequelize.query("SELECT id FROM motivos WHERE codigo = 'AJUSTE_CONTEO' AND deleted_at IS NULL", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    if (existe.length > 0) return;
    const now = new Date();
    await queryInterface.bulkInsert('motivos', [
      {
        uuid: crypto.randomUUID(),
        codigo: 'AJUSTE_CONTEO',
        nombre: 'Ajuste por conteo de inventario',
        descripcion: 'Diferencia entre el saldo del sistema y lo contado físicamente',
        tipo: 'AJUSTE',
        requiere_observacion: false,
        estado: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('motivos', { codigo: 'AJUSTE_CONTEO' });
  },
};
