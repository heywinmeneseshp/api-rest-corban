import { conteoHojasService } from '../../services/agricola/conteoHojas.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const conteoHojasController = {
  getByEvaluacion: asyncHandler(async (req, res) => {
    const conteo = await conteoHojasService.getConteoByEvaluacionUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Conteo de hojas obtenido correctamente', data: conteo });
  }),

  create: asyncHandler(async (req, res) => {
    const conteo = await conteoHojasService.createConteo(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Conteo de hojas registrado correctamente',
      data: conteo,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const conteo = await conteoHojasService.updateConteo(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Conteo de hojas actualizado correctamente', data: conteo });
  }),
};

export default conteoHojasController;
