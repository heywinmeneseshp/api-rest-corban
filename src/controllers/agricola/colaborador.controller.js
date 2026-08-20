import { colaboradorService } from '../../services/agricola/colaborador.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const colaboradorController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await colaboradorService.listColaboradores(req.query);
    ApiResponse.send(res, { message: 'Colaboradores obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.getColaboradorByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Colaborador obtenido correctamente', data: colaborador });
  }),

  create: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.createColaborador(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Colaborador creado correctamente',
      data: colaborador,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const colaborador = await colaboradorService.updateColaborador(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Colaborador actualizado correctamente', data: colaborador });
  }),

  remove: asyncHandler(async (req, res) => {
    await colaboradorService.deleteColaborador(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Colaborador eliminado correctamente' });
  }),
};

export default colaboradorController;
