import { equipoTipoService } from '../../services/inventario/equipoTipo.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const equipoTipoController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await equipoTipoService.list(req.query);
    ApiResponse.send(res, { message: 'Tipos de equipo obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const tipo = await equipoTipoService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Tipo de equipo obtenido correctamente', data: tipo });
  }),

  create: asyncHandler(async (req, res) => {
    const tipo = await equipoTipoService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Tipo de equipo creado correctamente', data: tipo });
  }),

  update: asyncHandler(async (req, res) => {
    const tipo = await equipoTipoService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Tipo de equipo actualizado correctamente', data: tipo });
  }),

  remove: asyncHandler(async (req, res) => {
    await equipoTipoService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Tipo de equipo eliminado correctamente' });
  }),
};

export default equipoTipoController;
