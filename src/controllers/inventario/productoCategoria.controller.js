import { productoCategoriaService } from '../../services/inventario/productoCategoria.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const productoCategoriaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await productoCategoriaService.list(req.query);
    ApiResponse.send(res, { message: 'Categorías obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const cat = await productoCategoriaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Categoría obtenida correctamente', data: cat });
  }),

  create: asyncHandler(async (req, res) => {
    const cat = await productoCategoriaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Categoría creada correctamente', data: cat });
  }),

  update: asyncHandler(async (req, res) => {
    const cat = await productoCategoriaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría actualizada correctamente', data: cat });
  }),

  remove: asyncHandler(async (req, res) => {
    await productoCategoriaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría eliminada correctamente' });
  }),
};

export default productoCategoriaController;
