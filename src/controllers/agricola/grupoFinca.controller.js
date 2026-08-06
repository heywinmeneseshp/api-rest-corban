import { grupoFincaService } from '../../services/agricola/grupoFinca.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const grupoFincaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await grupoFincaService.listGrupos(req.query);
    ApiResponse.send(res, { message: 'Grupos de finca obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const grupo = await grupoFincaService.getGrupoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Grupo de finca obtenido correctamente', data: grupo });
  }),

  create: asyncHandler(async (req, res) => {
    const grupo = await grupoFincaService.createGrupo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Grupo de finca creado correctamente',
      data: grupo,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const grupo = await grupoFincaService.updateGrupo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Grupo de finca actualizado correctamente', data: grupo });
  }),

  remove: asyncHandler(async (req, res) => {
    await grupoFincaService.deleteGrupo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Grupo de finca eliminado correctamente' });
  }),
};

export default grupoFincaController;
