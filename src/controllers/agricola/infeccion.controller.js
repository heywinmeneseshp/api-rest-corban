import { infeccionService } from '../../services/agricola/infeccion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const infeccionController = {
  getByEvaluacion: asyncHandler(async (req, res) => {
    const infeccion = await infeccionService.getInfeccionByEvaluacionUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Infección obtenida correctamente', data: infeccion });
  }),

  create: asyncHandler(async (req, res) => {
    const infeccion = await infeccionService.createInfeccion(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Infección registrada correctamente',
      data: infeccion,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const infeccion = await infeccionService.updateInfeccion(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Infección actualizada correctamente', data: infeccion });
  }),
};

export default infeccionController;
