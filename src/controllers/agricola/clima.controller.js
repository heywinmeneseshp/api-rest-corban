import { climaService } from '../../services/agricola/clima.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const climaController = {
  create: asyncHandler(async (req, res) => {
    const result = await climaService.create(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Clima registrado correctamente',
      data: result,
    });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await climaService.list(req.query);
    ApiResponse.send(res, { message: 'Registros de clima obtenidos correctamente', data: result });
  }),
};

export default climaController;
