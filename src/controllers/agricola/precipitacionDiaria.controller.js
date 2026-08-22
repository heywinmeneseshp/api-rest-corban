import { precipitacionDiariaService } from '../../services/agricola/precipitacionDiaria.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const precipitacionDiariaController = {
  getPendientes: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.getPendientes(req.user);
    ApiResponse.send(res, { message: 'Pendientes obtenidos correctamente', data: result });
  }),

  registrar: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.registrar(req.body.registros, req.user?.id, req.user?.usuario, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Precipitación registrada correctamente',
      data: result,
    });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.list(req.query);
    ApiResponse.send(res, { message: 'Registros obtenidos correctamente', data: result });
  }),

  listUsuarios: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.listUsuariosRegistrados();
    ApiResponse.send(res, { message: 'Usuarios obtenidos correctamente', data: result });
  }),

  listConfig: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.listConfig();
    ApiResponse.send(res, { message: 'Configuración obtenida correctamente', data: result });
  }),

  crearConfig: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.crearConfig(req.body, req.user?.usuario);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Configuración creada correctamente',
      data: result,
    });
  }),

  toggleConfig: asyncHandler(async (req, res) => {
    await precipitacionDiariaService.toggleConfig(req.params.uuid, req.body.activo);
    ApiResponse.send(res, { message: 'Configuración actualizada correctamente' });
  }),

  eliminarConfig: asyncHandler(async (req, res) => {
    await precipitacionDiariaService.eliminarConfig(req.params.uuid);
    ApiResponse.send(res, { message: 'Configuración eliminada correctamente' });
  }),

  listInconsistencias: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.listInconsistencias(req.query);
    ApiResponse.send(res, { message: 'Inconsistencias obtenidas correctamente', data: result });
  }),

  resolverInconsistencia: asyncHandler(async (req, res) => {
    const result = await precipitacionDiariaService.resolverInconsistencia(
      req.params.uuid,
      req.body.fuente,
      req.user?.id,
      req.user?.usuario,
      req.body.mm,
    );
    ApiResponse.send(res, { message: 'Inconsistencia resuelta correctamente', data: result });
  }),
};

export default precipitacionDiariaController;
