import { motivoRepiqueService } from '../../services/agricola/motivoRepique.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const motivoRepiqueController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await motivoRepiqueService.listMotivos(req.query);
    ApiResponse.send(res, { message: 'Motivos de repique obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const motivo = await motivoRepiqueService.getMotivoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Motivo de repique obtenido correctamente', data: motivo });
  }),

  create: asyncHandler(async (req, res) => {
    const motivo = await motivoRepiqueService.createMotivo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Motivo de repique creado correctamente',
      data: motivo,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const motivo = await motivoRepiqueService.updateMotivo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo de repique actualizado correctamente', data: motivo });
  }),

  remove: asyncHandler(async (req, res) => {
    await motivoRepiqueService.deleteMotivo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo de repique eliminado correctamente' });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const resultado = await motivoRepiqueService.bulkCreateMotivos(req.file, req.user?.id, { dryRun });
    ApiResponse.send(res, { message: 'Cargue masivo de motivos de repique procesado', data: resultado });
  }),
};

export default motivoRepiqueController;
