import { plantaService } from '../../services/agricola/planta.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const plantaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await plantaService.listPlantas(req.query);
    ApiResponse.send(res, { message: 'Plantas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const planta = await plantaService.getPlantaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Planta obtenida correctamente', data: planta });
  }),

  create: asyncHandler(async (req, res) => {
    const planta = await plantaService.createPlanta(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Planta creada correctamente',
      data: planta,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const planta = await plantaService.updatePlanta(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Planta actualizada correctamente', data: planta });
  }),

  remove: asyncHandler(async (req, res) => {
    await plantaService.deletePlanta(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Planta eliminada correctamente' });
  }),

  getByCode: asyncHandler(async (req, res) => {
    const planta = await plantaService.getPlantaByLoteAndCodigo(req.query.loteUuid, req.query.codigo);
    ApiResponse.send(res, { message: 'Planta obtenida correctamente', data: planta });
  }),

  listEvaluaciones: asyncHandler(async (req, res) => {
    const { items, meta } = await plantaService.listEvaluaciones(req.params.uuid, req.query);
    ApiResponse.send(res, {
      message: 'Evaluaciones de la planta obtenidas correctamente',
      data: { items, meta },
    });
  }),
};

export default plantaController;
