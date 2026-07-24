import { setupService } from '../../services/sistema/setup.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const setupController = {
  estado: asyncHandler(async (req, res) => {
    const data = await setupService.getEstado();
    ApiResponse.send(res, { message: 'Estado de configuración inicial obtenido correctamente', data });
  }),

  completar: asyncHandler(async (req, res) => {
    const data = await setupService.completarSetup(req.body);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Configuración inicial completada correctamente',
      data,
    });
  }),
};

export default setupController;
