import { programacionCorteService } from '../../services/agricola/programacionCorte.service.js';
import { evaluacionService } from '../../services/agricola/evaluacion.service.js';
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

  // Llamado una vez por semana por Vercel Cron (ver vercel.json), al iniciar
  // la semana — manda el correo de Alertas de Sanidad Vegetal de la semana
  // que recién cerró (ver evaluacionService.enviarAlertasSemanaCerrada).
  enviarAlertasSanidadVegetal: asyncHandler(async (req, res) => {
    const result = await evaluacionService.enviarAlertasSemanaCerrada({});
    ApiResponse.send(res, {
      message: result.enviado
        ? `Correo de alertas de Sanidad Vegetal enviado a ${result.destinatarios.length} destinatario(s)`
        : 'Alertas de Sanidad Vegetal: nada que enviar (sin alertas o sin destinatarios configurados)',
      data: result,
    });
  }),
};

export default cronController;
