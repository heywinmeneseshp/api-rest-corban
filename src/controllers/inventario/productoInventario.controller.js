import { productoInventarioService } from '../../services/inventario/productoInventario.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const productoInventarioController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await productoInventarioService.list(req.query);
    ApiResponse.send(res, { message: 'Productos obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const prod = await productoInventarioService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Producto obtenido correctamente', data: prod });
  }),
  create: asyncHandler(async (req, res) => {
    const prod = await productoInventarioService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Producto creado correctamente', data: prod });
  }),
  update: asyncHandler(async (req, res) => {
    const prod = await productoInventarioService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Producto actualizado correctamente', data: prod });
  }),
  remove: asyncHandler(async (req, res) => {
    await productoInventarioService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Producto eliminado correctamente' });
  }),
};

export default productoInventarioController;
