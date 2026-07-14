import { evaluacionService } from '../../services/agricola/evaluacion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const evaluacionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await evaluacionService.listEvaluaciones(req.query);
    ApiResponse.send(res, { message: 'Evaluaciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.getEvaluacionByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Evaluación obtenida correctamente', data: evaluacion });
  }),

  create: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.createEvaluacion(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Evaluación creada correctamente',
      data: evaluacion,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.updateEvaluacion(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Evaluación actualizada correctamente', data: evaluacion });
  }),

  remove: asyncHandler(async (req, res) => {
    await evaluacionService.deleteEvaluacion(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Evaluación anulada correctamente' });
  }),
};

export default evaluacionController;
