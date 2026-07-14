import { categoriaPlantaService } from '../../services/agricola/categoriaPlanta.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const categoriaPlantaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await categoriaPlantaService.listCategorias(req.query);
    ApiResponse.send(res, {
      message: 'Categorías de planta obtenidas correctamente',
      data: { items, meta },
    });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const categoria = await categoriaPlantaService.getCategoriaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Categoría de planta obtenida correctamente', data: categoria });
  }),

  create: asyncHandler(async (req, res) => {
    const categoria = await categoriaPlantaService.createCategoria(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Categoría de planta creada correctamente',
      data: categoria,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const categoria = await categoriaPlantaService.updateCategoria(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría de planta actualizada correctamente', data: categoria });
  }),

  remove: asyncHandler(async (req, res) => {
    await categoriaPlantaService.deleteCategoria(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Categoría de planta eliminada correctamente' });
  }),
};

export default categoriaPlantaController;
