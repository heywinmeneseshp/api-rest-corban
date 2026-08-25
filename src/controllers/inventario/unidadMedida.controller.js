import { unidadMedidaService } from '../../services/inventario/unidadMedida.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const unidadMedidaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await unidadMedidaService.list(req.query);
    ApiResponse.send(res, { message: 'Unidades obtenidas correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const uni = await unidadMedidaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Unidad obtenida correctamente', data: uni });
  }),
  create: asyncHandler(async (req, res) => {
    const uni = await unidadMedidaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Unidad creada correctamente', data: uni });
  }),
  update: asyncHandler(async (req, res) => {
    const uni = await unidadMedidaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Unidad actualizada correctamente', data: uni });
  }),
  remove: asyncHandler(async (req, res) => {
    await unidadMedidaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Unidad eliminada correctamente' });
  }),
  listConversiones: asyncHandler(async (_req, res) => {
    const items = await unidadMedidaService.listConversiones();
    ApiResponse.send(res, { message: 'Conversiones obtenidas correctamente', data: items });
  }),
  createConversion: asyncHandler(async (req, res) => {
    const conv = await unidadMedidaService.createConversion(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Conversión creada correctamente', data: conv });
  }),
  deleteConversion: asyncHandler(async (req, res) => {
    await unidadMedidaService.deleteConversion(req.params.uuid);
    ApiResponse.send(res, { message: 'Conversión eliminada correctamente' });
  }),
};

export default unidadMedidaController;
