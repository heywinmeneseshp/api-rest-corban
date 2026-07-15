import { fincaService } from '../../services/agricola/finca.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const fincaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await fincaService.listFincas(req.query);
    ApiResponse.send(res, { message: 'Fincas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const finca = await fincaService.getFincaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Finca obtenida correctamente', data: finca });
  }),

  create: asyncHandler(async (req, res) => {
    const finca = await fincaService.createFinca(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Finca creada correctamente',
      data: finca,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const finca = await fincaService.updateFinca(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Finca actualizada correctamente', data: finca });
  }),

  remove: asyncHandler(async (req, res) => {
    await fincaService.deleteFinca(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Finca eliminada correctamente' });
  }),

  listLotes: asyncHandler(async (req, res) => {
    const { items, meta } = await fincaService.listLotes(req.params.uuid, req.query);
    ApiResponse.send(res, { message: 'Lotes de la finca obtenidos correctamente', data: { items, meta } });
  }),

  syncBanarica: asyncHandler(async (req, res) => {
    const resultado = await fincaService.syncFromBanarica(req.user?.id);
    ApiResponse.send(res, {
      message: 'Sincronización con banarica completada',
      data: resultado,
    });
  }),
};

export default fincaController;
