import { productoService } from '../../services/agricola/producto.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const productoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await productoService.listProductos(req.query);
    ApiResponse.send(res, { message: 'Productos obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const producto = await productoService.getProductoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Producto obtenido correctamente', data: producto });
  }),

  create: asyncHandler(async (req, res) => {
    const producto = await productoService.createProducto(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Producto creado correctamente',
      data: producto,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const producto = await productoService.updateProducto(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Producto actualizado correctamente', data: producto });
  }),

  remove: asyncHandler(async (req, res) => {
    await productoService.deleteProducto(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Producto eliminado correctamente' });
  }),

  previewBanarica: asyncHandler(async (req, res) => {
    const resultado = await productoService.previewBanaricaCombos();
    ApiResponse.send(res, { message: 'Combos activos de Logística obtenidos correctamente', data: resultado });
  }),

  syncBanarica: asyncHandler(async (req, res) => {
    const resultado = await productoService.syncFromBanarica(req.user?.id, req.body.consecutivos);
    ApiResponse.send(res, { message: 'Sincronización con Logística completada', data: resultado });
  }),
};

export default productoController;
