import { rechazoCorteService } from '../../services/agricola/rechazoCorte.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const rechazoCorteController = {
  // Llamado por api-rest-banarica (webhook) cada vez que se crea, edita,
  // elimina, aprueba o restaura un rechazo — ver requireApiKey.middleware.js
  // y rechazoCorteService.syncSemanaWebhook.
  webhookSync: asyncHandler(async (req, res) => {
    const resultado = await rechazoCorteService.syncSemanaWebhook(req.body.semana, req.body.rechazos);
    ApiResponse.send(res, { message: 'Sincronización de rechazos completada', data: resultado });
  }),

  resumenPorSemana: asyncHandler(async (req, res) => {
    const data = await rechazoCorteService.getResumenPorSemana(req.query.semanaUuid);
    ApiResponse.send(res, { message: 'Resumen de rechazos obtenido correctamente', data });
  }),
};

export default rechazoCorteController;
