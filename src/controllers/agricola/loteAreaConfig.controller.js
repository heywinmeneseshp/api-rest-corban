import { loteAreaConfigService } from '../../services/agricola/loteAreaConfig.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const loteAreaConfigController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await loteAreaConfigService.listConfig(req.query);
    ApiResponse.send(res, { message: 'Configuraciones de área de lotes obtenidas correctamente', data: { items, meta } });
  }),

  create: asyncHandler(async (req, res) => {
    const config = await loteAreaConfigService.crearConfig(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Configuración de área de lotes creada correctamente',
      data: config,
    });
  }),

  toggle: asyncHandler(async (req, res) => {
    const config = await loteAreaConfigService.toggleConfig(req.params.uuid, req.body.activo, req.user?.id);
    ApiResponse.send(res, { message: 'Configuración actualizada correctamente', data: config });
  }),

  remove: asyncHandler(async (req, res) => {
    await loteAreaConfigService.eliminarConfig(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Configuración eliminada correctamente' });
  }),

  pendientes: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.getPendientes(req.user);
    ApiResponse.send(res, { message: 'Pendientes obtenidos correctamente', data });
  }),

  registrar: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.registrarLotes(req.body.registros, req.user?.id);
    ApiResponse.send(res, { message: 'Área de lotes registrada correctamente', data });
  }),
};

export default loteAreaConfigController;
