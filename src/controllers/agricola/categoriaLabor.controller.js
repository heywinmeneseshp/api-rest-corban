import { categoriaLaborService } from '../../services/agricola/categoriaLabor.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const categoriaLaborController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await categoriaLaborService.listCategorias(req.query);
    ApiResponse.send(res, { message: 'Categorías de labor obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const categoria = await categoriaLaborService.getCategoriaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Categoría de labor obtenida correctamente', data: categoria });
  }),

  create: asyncHandler(async (req, res) => {
    const categoria = await categoriaLaborService.createCategoria(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Categoría de labor creada correctamente',
      data: categoria,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const categoria = await categoriaLaborService.updateCategoria(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría de labor actualizada correctamente', data: categoria });
  }),

  remove: asyncHandler(async (req, res) => {
    await categoriaLaborService.deleteCategoria(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría de labor eliminada correctamente' });
  }),
};

export default categoriaLaborController;
