import { evaluacionService } from '../../services/agricola/evaluacion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const evaluacionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await evaluacionService.listEvaluaciones(req.query, req.user);
    ApiResponse.send(res, { message: 'Evaluaciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.getEvaluacionByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Evaluación obtenida correctamente', data: evaluacion });
  }),

  create: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.createEvaluacion(req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Evaluación creada correctamente',
      data: evaluacion,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.updateEvaluacion(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Evaluación actualizada correctamente', data: evaluacion });
  }),

  remove: asyncHandler(async (req, res) => {
    await evaluacionService.deleteEvaluacion(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Evaluación anulada correctamente' });
  }),

  promedioSumaBruta: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioSumaBrutaPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de suma bruta por semana obtenido correctamente',
      data: { items },
    });
  }),

  promedioConteo: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioConteoPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de conteo de hojas por semana obtenido correctamente',
      data: { items },
    });
  }),

  promedioInfeccion: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioInfeccionPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de índice de infección por semana obtenido correctamente',
      data: { items },
    });
  }),

  indicadores: asyncHandler(async (req, res) => {
    const data = await evaluacionService.indicadoresPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Indicadores de evaluaciones obtenidos correctamente',
      data,
    });
  }),
};

export default evaluacionController;
