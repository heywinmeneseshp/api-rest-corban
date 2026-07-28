import { precipitacionService } from '../../services/agricola/precipitacion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const precipitacionController = {
  create: asyncHandler(async (req, res) => {
    const result = await precipitacionService.create(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Precipitación registrada correctamente',
      data: result,
    });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await precipitacionService.list(req.query);
    ApiResponse.send(res, { message: 'Precipitaciones obtenidas correctamente', data: result });
  }),
};

export default precipitacionController;
