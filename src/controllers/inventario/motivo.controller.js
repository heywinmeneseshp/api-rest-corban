import { motivoService } from '../../services/inventario/motivo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const motivoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await motivoService.list(req.query);
    ApiResponse.send(res, { message: 'Motivos obtenidos correctamente', data: { items, meta } });
  }),
  getByUuid: asyncHandler(async (req, res) => {
    const motivo = await motivoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Motivo obtenido correctamente', data: motivo });
  }),
  create: asyncHandler(async (req, res) => {
    const motivo = await motivoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Motivo creado correctamente', data: motivo });
  }),
  update: asyncHandler(async (req, res) => {
    const motivo = await motivoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo actualizado correctamente', data: motivo });
  }),
  remove: asyncHandler(async (req, res) => {
    await motivoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Motivo eliminado correctamente' });
  }),
};

export default motivoController;
