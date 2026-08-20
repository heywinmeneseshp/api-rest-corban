import { programacionCorteService } from '../../services/agricola/programacionCorte.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const cronController = {
  // Llamado una vez al día por Vercel Cron (ver vercel.json) — recalcula
  // Producción Semanal para que el corte "solo cuenta hasta ayer" de
  // Programación de Corte avance solo, sin depender de que alguien
  // sincronice/edite algo ese día (ver
  // programacionCorteRepository.sumarPesoPorFincaYSemana).
  recalcularProduccionSemanal: asyncHandler(async (req, res) => {
    await programacionCorteService.recalcularTodaProduccionSemanal(null);
    ApiResponse.send(res, { message: 'Producción Semanal recalculada correctamente' });
  }),
};

export default cronController;
