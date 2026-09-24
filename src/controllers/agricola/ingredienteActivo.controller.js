import { ingredienteActivoService } from '../../services/agricola/ingredienteActivo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const ingredienteActivoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await ingredienteActivoService.listIngredientesActivos(req.query);
    ApiResponse.send(res, {
      message: 'Ingredientes activos obtenidos correctamente',
      data: { items, meta },
    });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const ingrediente = await ingredienteActivoService.getIngredienteActivoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Ingrediente activo obtenido correctamente', data: ingrediente });
  }),

  create: asyncHandler(async (req, res) => {
    const ingrediente = await ingredienteActivoService.createIngredienteActivo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Ingrediente activo creado correctamente',
      data: ingrediente,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const ingrediente = await ingredienteActivoService.updateIngredienteActivo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Ingrediente activo actualizado correctamente', data: ingrediente });
  }),

  remove: asyncHandler(async (req, res) => {
    await ingredienteActivoService.deleteIngredienteActivo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Ingrediente activo eliminado correctamente' });
  }),
};

export default ingredienteActivoController;
