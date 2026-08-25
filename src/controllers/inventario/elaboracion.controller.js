import { elaboracionService } from '../../services/inventario/elaboracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const elaboracionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await elaboracionService.list(req.query);
    ApiResponse.send(res, { message: 'Elaboraciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const elaboracion = await elaboracionService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Elaboración obtenida correctamente', data: elaboracion });
  }),

  create: asyncHandler(async (req, res) => {
    const elaboracion = await elaboracionService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Elaboración creada correctamente', data: elaboracion });
  }),
};

export default elaboracionController;
