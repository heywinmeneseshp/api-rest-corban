'use strict';

/** @type {import('sequelize-cli').Migration} */
// La migración 20260903000000 intentó eliminar el índice único viejo
// (semana_id, finca_id, created_by) al reemplazarlo por uno que también
// incluye semana_registro_id, pero el removeConstraint/removeIndex falló
// en silencio (catch vacío) y el índice viejo se quedó vivo junto al
// nuevo. Con los dos activos, cualquier INSERT ... ON DUPLICATE KEY UPDATE
// (el cargue masivo) dispara sobre el índice viejo apenas dos filas
// comparten semana objetivo + finca + usuario — algo MUY común en la
// vista escalera, donde una misma semana objetivo es estimada por varias
// semanas de registro distintas (S01 estima S02..S09, S02 estima
// S03..S10, etc.) — así que cada cargue nuevo pisaba silenciosamente el
// valor de un registro anterior en vez de crear su propia fila.
module.exports = {
  async up(queryInterface) {
    const [indexes] = await queryInterface.sequelize.query('SHOW INDEX FROM estimaciones_finca;');
    const tieneIndiceViejo = indexes.some((i) => i.Key_name === 'uq_est_semana_finca_usuario');
    if (!tieneIndiceViejo) return;

    try {
      await queryInterface.removeConstraint('estimaciones_finca', 'uq_est_semana_finca_usuario');
    } catch {
      await queryInterface.removeIndex('estimaciones_finca', 'uq_est_semana_finca_usuario');
    }
  },

  async down(queryInterface) {
    // No se recrea: el índice viejo era incorrecto (más estricto de lo
    // que el modelo de datos necesita desde que existe semana_registro_id)
    // y volver a agregarlo reintroduciría el bug de pisado silencioso.
    void queryInterface;
  },
};
