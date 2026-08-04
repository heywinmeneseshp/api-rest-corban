import { laborService } from '../../services/agricola/labor.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const laborController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await laborService.listLabores(req.query);
    ApiResponse.send(res, { message: 'Labores obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const labor = await laborService.getLaborByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Labor obtenida correctamente', data: labor });
  }),

  create: asyncHandler(async (req, res) => {
    const labor = await laborService.createLabor(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Labor creada correctamente',
      data: labor,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const labor = await laborService.updateLabor(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Labor actualizada correctamente', data: labor });
  }),

  remove: asyncHandler(async (req, res) => {
    await laborService.deleteLabor(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Labor eliminada correctamente' });
  }),
};

export default laborController;
