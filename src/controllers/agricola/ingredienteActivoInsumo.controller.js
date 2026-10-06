import { ingredienteActivoInsumoService } from '../../services/agricola/ingredienteActivoInsumo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const ingredienteActivoInsumoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await ingredienteActivoInsumoService.listInsumos(req.query, req.user);
    ApiResponse.send(res, { message: 'Insumos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const insumo = await ingredienteActivoInsumoService.getInsumoByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Insumo obtenido correctamente', data: insumo });
  }),

  create: asyncHandler(async (req, res) => {
    const insumo = await ingredienteActivoInsumoService.createInsumo(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Insumo creado correctamente', data: insumo });
  }),

  update: asyncHandler(async (req, res) => {
    const insumo = await ingredienteActivoInsumoService.updateInsumo(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Insumo actualizado correctamente', data: insumo });
  }),

  remove: asyncHandler(async (req, res) => {
    await ingredienteActivoInsumoService.deleteInsumo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Insumo eliminado correctamente' });
  }),

  listDeleted: asyncHandler(async (req, res) => {
    const { items, meta } = await ingredienteActivoInsumoService.listDeletedInsumos(req.query);
    ApiResponse.send(res, { message: 'Insumos eliminados obtenidos correctamente', data: { items, meta } });
  }),

  restore: asyncHandler(async (req, res) => {
    const insumo = await ingredienteActivoInsumoService.restoreInsumo(req.params.uuid);
    ApiResponse.send(res, { message: 'Insumo restaurado correctamente', data: insumo });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const resultado = await ingredienteActivoInsumoService.bulkCreateInsumos(req.file, req.user?.id, { dryRun });
    ApiResponse.send(res, { message: 'Cargue masivo de insumos procesado', data: resultado });
  }),
};

export default ingredienteActivoInsumoController;
