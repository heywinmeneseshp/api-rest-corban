import { tipoEvaluacionService } from '../../services/agricola/tipoEvaluacion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const tipoEvaluacionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await tipoEvaluacionService.listTipos(req.query);
    ApiResponse.send(res, { message: 'Tipos de evaluación obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const tipo = await tipoEvaluacionService.getTipoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Tipo de evaluación obtenido correctamente', data: tipo });
  }),

  create: asyncHandler(async (req, res) => {
    const tipo = await tipoEvaluacionService.createTipo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Tipo de evaluación creado correctamente',
      data: tipo,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const tipo = await tipoEvaluacionService.updateTipo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Tipo de evaluación actualizado correctamente', data: tipo });
  }),

  remove: asyncHandler(async (req, res) => {
    await tipoEvaluacionService.deleteTipo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Tipo de evaluación eliminado correctamente' });
  }),
};

export default tipoEvaluacionController;
