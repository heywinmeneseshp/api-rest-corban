import { articuloService } from '../../services/inventario/articulo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const articuloController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await articuloService.list(req.query);
    ApiResponse.send(res, { message: 'Artículos obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const art = await articuloService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Artículo obtenido correctamente', data: art });
  }),
  create: asyncHandler(async (req, res) => {
    const art = await articuloService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Artículo creado correctamente', data: art });
  }),
  update: asyncHandler(async (req, res) => {
    const art = await articuloService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Artículo actualizado correctamente', data: art });
  }),
  remove: asyncHandler(async (req, res) => {
    await articuloService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Artículo eliminado correctamente' });
  }),
};

export default articuloController;
