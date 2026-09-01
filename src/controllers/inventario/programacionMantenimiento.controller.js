import { programacionMantenimientoService } from '../../services/inventario/programacionMantenimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const programacionMantenimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await programacionMantenimientoService.list(req.query);
    ApiResponse.send(res, { message: 'Programaciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const prog = await programacionMantenimientoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Programación obtenida correctamente', data: prog });
  }),

  create: asyncHandler(async (req, res) => {
    const prog = await programacionMantenimientoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Programación creada correctamente', data: prog });
  }),

  update: asyncHandler(async (req, res) => {
    const prog = await programacionMantenimientoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Programación actualizada correctamente', data: prog });
  }),

  remove: asyncHandler(async (req, res) => {
    await programacionMantenimientoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Programación eliminada correctamente' });
  }),
};

export default programacionMantenimientoController;
