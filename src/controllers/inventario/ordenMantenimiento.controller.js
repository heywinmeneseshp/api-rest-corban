import { ordenMantenimientoService } from '../../services/inventario/ordenMantenimiento.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const ordenMantenimientoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await ordenMantenimientoService.list(req.query);
    ApiResponse.send(res, { message: 'Órdenes obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const orden = await ordenMantenimientoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Orden obtenida correctamente', data: orden });
  }),

  create: asyncHandler(async (req, res) => {
    const orden = await ordenMantenimientoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Orden creada correctamente', data: orden });
  }),

  update: asyncHandler(async (req, res) => {
    const orden = await ordenMantenimientoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Orden actualizada correctamente', data: orden });
  }),

  remove: asyncHandler(async (req, res) => {
    await ordenMantenimientoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Orden eliminada correctamente' });
  }),

  cerrar: asyncHandler(async (req, res) => {
    const orden = await ordenMantenimientoService.cerrar(req.params.uuid, req.body || {}, req.user?.id);
    ApiResponse.send(res, { message: 'Orden cerrada correctamente (salida de inventario generada si aplica)', data: orden });
  }),
};

export default ordenMantenimientoController;
