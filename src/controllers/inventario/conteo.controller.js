import { conteoService } from '../../services/inventario/conteo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const conteoController = {
  list: asyncHandler(async (req, res) => {
    const data = await conteoService.list(req.query, req.user);
    ApiResponse.send(res, { message: 'Conteos obtenidos correctamente', data });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const data = await conteoService.getByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Conteo obtenido correctamente', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await conteoService.create(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Conteo creado correctamente', data });
  }),

  guardarLineas: asyncHandler(async (req, res) => {
    const data = await conteoService.guardarLineas(req.params.uuid, req.body.lineas, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Conteo guardado correctamente', data });
  }),

  cerrar: asyncHandler(async (req, res) => {
    const data = await conteoService.cerrar(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Conteo cerrado y ajustes aplicados', data });
  }),

  anular: asyncHandler(async (req, res) => {
    const data = await conteoService.anular(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Conteo anulado correctamente', data });
  }),
};
