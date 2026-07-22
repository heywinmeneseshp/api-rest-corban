import { sumaBrutaService } from '../../services/agricola/sumaBruta.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const sumaBrutaController = {
  getByEvaluacion: asyncHandler(async (req, res) => {
    const sumaBruta = await sumaBrutaService.getSumaBrutaByEvaluacionUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Suma bruta obtenida correctamente', data: sumaBruta });
  }),

  create: asyncHandler(async (req, res) => {
    const sumaBruta = await sumaBrutaService.createSumaBruta(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Suma bruta registrada correctamente',
      data: sumaBruta,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const sumaBruta = await sumaBrutaService.updateSumaBruta(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Suma bruta actualizada correctamente', data: sumaBruta });
  }),
};

export default sumaBrutaController;
