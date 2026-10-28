import { colaboradorService } from '../../services/agricola/colaborador.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const colaboradorController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await colaboradorService.listColaboradores(req.query, req.user);
    ApiResponse.send(res, { message: 'Colaboradores obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.getColaboradorByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Colaborador obtenido correctamente', data: colaborador });
  }),

  create: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.createColaborador(req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Colaborador creado correctamente',
      data: colaborador,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.updateColaborador(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Colaborador actualizado correctamente', data: colaborador });
  }),

  vincularUsuario: asyncHandler(async (req, res) => {
    const data = await colaboradorService.vincularUsuario(req.params.uuid, req.body.userUuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Usuario vinculado correctamente', data });
  }),

  desvincularUsuario: asyncHandler(async (req, res) => {
    const data = await colaboradorService.desvincularUsuario(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Usuario desvinculado correctamente', data });
  }),

  crearUsuario: asyncHandler(async (req, res) => {
    const data = await colaboradorService.crearUsuario(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Usuario creado y vinculado correctamente', data });
  }),

  miFicha: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Ficha obtenida correctamente', data: await colaboradorService.miFicha(req.user) });
  }),

  crearMiFicha: asyncHandler(async (req, res) => {
    const data = await colaboradorService.crearMiFicha(req.body, req.user);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Tu ficha de colaborador quedó creada', data });
  }),

  actualizarMiFicha: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Tu ficha quedó actualizada', data: await colaboradorService.actualizarMiFicha(req.body, req.user) });
  }),

  remove: asyncHandler(async (req, res) => {
    await colaboradorService.deleteColaborador(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Colaborador eliminado correctamente' });
  }),
};

export default colaboradorController;
