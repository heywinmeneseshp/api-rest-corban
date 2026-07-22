import { loteService } from '../../services/agricola/lote.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const loteController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await loteService.listLotes(req.query, req.user);
    ApiResponse.send(res, { message: 'Lotes obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const lote = await loteService.getLoteByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Lote obtenido correctamente', data: lote });
  }),

  create: asyncHandler(async (req, res) => {
    const lote = await loteService.createLote(req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Lote creado correctamente',
      data: lote,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const lote = await loteService.updateLote(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Lote actualizado correctamente', data: lote });
  }),

  remove: asyncHandler(async (req, res) => {
    await loteService.deleteLote(req.params.uuid, req.user?.id, req.user?.roles);
    ApiResponse.send(res, { message: 'Lote eliminado correctamente' });
  }),

  listPlantas: asyncHandler(async (req, res) => {
    const { items, meta } = await loteService.listPlantas(req.params.uuid, req.query, req.user);
    ApiResponse.send(res, { message: 'Plantas del lote obtenidas correctamente', data: { items, meta } });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const resultado = await loteService.bulkCreateLotes(req.file, req.user?.id, { dryRun, user: req.user });
    ApiResponse.send(res, { message: 'Cargue masivo de lotes procesado', data: resultado });
  }),

  listAreaProduccion: asyncHandler(async (req, res) => {
    const { items, meta } = await loteService.listAreaProduccion(req.params.uuid, req.query, req.user);
    ApiResponse.send(res, {
      message: 'Historial de área en producción obtenido correctamente',
      data: { items, meta },
    });
  }),

  registerAreaProduccion: asyncHandler(async (req, res) => {
    const registro = await loteService.registerAreaProduccion(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Área en producción registrada correctamente',
      data: registro,
    });
  }),
};

export default loteController;
