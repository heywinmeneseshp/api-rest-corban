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
    const { config, creada } = await loteAreaConfigService.crearConfig(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: creada
        ? 'Configuración de área de lotes creada correctamente'
        : 'Ya existía configuración para esa finca y rol: se actualizó la fecha',
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
    const data = await loteAreaConfigService.registrarLotes(req.body.registros, req.user?.id, req.user);
    const pendiente = data.some((r) => r.pendienteAprobacion);
    ApiResponse.send(res, {
      message: pendiente ? 'Cambios enviados: quedan pendientes de aprobación' : 'Área de lotes registrada correctamente',
      data,
    });
  }),

  solicitudes: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.listSolicitudes({ estado: req.query.estado });
    ApiResponse.send(res, { message: 'Solicitudes obtenidas correctamente', data });
  }),

  aprobarSolicitud: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.aprobarSolicitud(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Solicitud aprobada y aplicada al lote', data });
  }),

  rechazarSolicitud: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.rechazarSolicitud(req.params.uuid, req.body.motivo, req.user?.id);
    ApiResponse.send(res, { message: 'Solicitud rechazada', data });
  }),

  eliminarLotePendiente: asyncHandler(async (req, res) => {
    await loteAreaConfigService.eliminarLotePendiente(req.params.loteUuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Lote ocultado del pendiente correctamente' });
  }),

  agregarLotePendiente: asyncHandler(async (req, res) => {
    const data = await loteAreaConfigService.agregarLotePendiente(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Lote creado correctamente', data });
  }),
};

export default loteAreaConfigController;
