import { estadioSigatokaService } from '../../services/agricola/estadioSigatoka.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const estadioSigatokaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await estadioSigatokaService.listEstadios(req.query);
    ApiResponse.send(res, { message: 'Estadios de Sigatoka obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const estadio = await estadioSigatokaService.getEstadioByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Estadio de Sigatoka obtenido correctamente', data: estadio });
  }),

  create: asyncHandler(async (req, res) => {
    const estadio = await estadioSigatokaService.createEstadio(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Estadio de Sigatoka creado correctamente',
      data: estadio,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const estadio = await estadioSigatokaService.updateEstadio(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Estadio de Sigatoka actualizado correctamente', data: estadio });
  }),

  remove: asyncHandler(async (req, res) => {
    await estadioSigatokaService.deleteEstadio(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Estadio de Sigatoka eliminado correctamente' });
  }),
};

export default estadioSigatokaController;
