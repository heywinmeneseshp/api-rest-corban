import { motivoRecuseService } from '../../services/agricola/motivoRecuse.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const motivoRecuseController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await motivoRecuseService.listMotivos(req.query);
    ApiResponse.send(res, { message: 'Motivos de recuse obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const motivo = await motivoRecuseService.getMotivoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Motivo de recuse obtenido correctamente', data: motivo });
  }),

  create: asyncHandler(async (req, res) => {
    const motivo = await motivoRecuseService.createMotivo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Motivo de recuse creado correctamente',
      data: motivo,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const motivo = await motivoRecuseService.updateMotivo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo de recuse actualizado correctamente', data: motivo });
  }),

  remove: asyncHandler(async (req, res) => {
    await motivoRecuseService.deleteMotivo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo de recuse eliminado correctamente' });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === 'true';
    const resultado = await motivoRecuseService.bulkCreateMotivos(req.file, req.user?.id, { dryRun });
    ApiResponse.send(res, { message: 'Cargue masivo de motivos de recuse procesado', data: resultado });
  }),
};

export default motivoRecuseController;
