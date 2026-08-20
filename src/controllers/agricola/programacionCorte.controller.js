import { programacionCorteService } from '../../services/agricola/programacionCorte.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const programacionCorteController = {
  list: asyncHandler(async (req, res) => {
    const data = await programacionCorteService.listProgramacion(req.query, req.user);
    ApiResponse.send(res, { message: 'Programación de corte obtenida correctamente', data });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const resultado = await programacionCorteService.bulkCreateProgramacion(req.file, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Cargue masivo de programación de corte procesado', data: resultado });
  }),

  syncBanarica: asyncHandler(async (req, res) => {
    const resultado = await programacionCorteService.syncFromBanarica(req.user?.id, req.user, req.body.semanaUuid);
    ApiResponse.send(res, { message: 'Sincronización con Logística completada', data: resultado });
  }),

  // Llamado por api-rest-banarica (webhook), no por el frontend — ver
  // requireApiKey.middleware.js y programacionCorteService.syncSemanaWebhook.
  webhookSync: asyncHandler(async (req, res) => {
    const resultado = await programacionCorteService.syncSemanaWebhook(req.body.semana);
    ApiResponse.send(res, { message: 'Sincronización con Logística completada', data: resultado });
  }),

  remove: asyncHandler(async (req, res) => {
    await programacionCorteService.deleteProgramacion(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Registro de programación de corte eliminado correctamente' });
  }),
};

export default programacionCorteController;
