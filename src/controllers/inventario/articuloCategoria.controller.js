import { articuloCategoriaService } from '../../services/inventario/articuloCategoria.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const articuloCategoriaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await articuloCategoriaService.list(req.query);
    ApiResponse.send(res, { message: 'Categorías obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const cat = await articuloCategoriaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Categoría obtenida correctamente', data: cat });
  }),

  create: asyncHandler(async (req, res) => {
    const cat = await articuloCategoriaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Categoría creada correctamente', data: cat });
  }),

  update: asyncHandler(async (req, res) => {
    const cat = await articuloCategoriaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría actualizada correctamente', data: cat });
  }),

  remove: asyncHandler(async (req, res) => {
    await articuloCategoriaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría eliminada correctamente' });
  }),
};

export default articuloCategoriaController;
