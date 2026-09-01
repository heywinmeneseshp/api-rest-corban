import { planMantenimientoService } from '../../services/inventario/planMantenimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const planMantenimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await planMantenimientoService.list(req.query);
    ApiResponse.send(res, { message: 'Planes obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const plan = await planMantenimientoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Plan obtenido correctamente', data: plan });
  }),

  create: asyncHandler(async (req, res) => {
    const plan = await planMantenimientoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Plan creado correctamente', data: plan });
  }),

  update: asyncHandler(async (req, res) => {
    const plan = await planMantenimientoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Plan actualizado correctamente', data: plan });
  }),

  remove: asyncHandler(async (req, res) => {
    await planMantenimientoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Plan eliminado correctamente' });
  }),
};

export default planMantenimientoController;
