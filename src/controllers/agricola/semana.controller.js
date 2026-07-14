import { semanaService } from '../../services/agricola/semana.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const semanaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await semanaService.listSemanas(req.query);
    ApiResponse.send(res, { message: 'Semanas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const semana = await semanaService.getSemanaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Semana obtenida correctamente', data: semana });
  }),

  create: asyncHandler(async (req, res) => {
    const semana = await semanaService.createSemana(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Semana creada correctamente',
      data: semana,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const semana = await semanaService.updateSemana(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Semana actualizada correctamente', data: semana });
  }),

  remove: asyncHandler(async (req, res) => {
    await semanaService.deleteSemana(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Semana eliminada correctamente' });
  }),
};

export default semanaController;
