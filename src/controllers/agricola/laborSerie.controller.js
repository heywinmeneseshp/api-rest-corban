import { laborSerieService } from '../../services/agricola/laborSerie.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const laborSerieController = {
  getByUuid: asyncHandler(async (req, res) => {
    const serie = await laborSerieService.getSerieByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Programación obtenida correctamente', data: serie });
  }),

  create: asyncHandler(async (req, res) => {
    const { serie, totalOcurrencias } = await laborSerieService.crearSerie(req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: `Programación creada correctamente (${totalOcurrencias} ocurrencia${totalOcurrencias === 1 ? '' : 's'} generada${totalOcurrencias === 1 ? '' : 's'})`,
      data: serie,
    });
  }),

  remove: asyncHandler(async (req, res) => {
    await laborSerieService.deleteSerie(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Programación eliminada correctamente' });
  }),
};

export default laborSerieController;
