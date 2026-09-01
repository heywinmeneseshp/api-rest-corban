import { mezclaService } from '../../services/inventario/mezcla.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const mezclaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await mezclaService.list(req.query);
    ApiResponse.send(res, { message: 'Mezclas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Mezcla obtenida correctamente', data: mezcla });
  }),

  create: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Mezcla creada correctamente', data: mezcla });
  }),

  update: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Mezcla actualizada correctamente', data: mezcla });
  }),

  remove: asyncHandler(async (req, res) => {
    await mezclaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Mezcla eliminada correctamente' });
  }),
};

export default mezclaController;
