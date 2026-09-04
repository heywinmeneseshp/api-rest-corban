import { zonaService } from '../../services/agricola/zona.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const zonaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await zonaService.listZonas(req.query);
    ApiResponse.send(res, { message: 'Zonas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const zona = await zonaService.getZonaByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Zona obtenida correctamente', data: zona });
  }),

  create: asyncHandler(async (req, res) => {
    const zona = await zonaService.createZona(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Zona creada correctamente', data: zona });
  }),

  update: asyncHandler(async (req, res) => {
    const zona = await zonaService.updateZona(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Zona actualizada correctamente', data: zona });
  }),

  remove: asyncHandler(async (req, res) => {
    await zonaService.deleteZona(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Zona eliminada correctamente' });
  }),

  listFincas: asyncHandler(async (req, res) => {
    const fincas = await zonaService.listZonaFincas(req.params.uuid);
    ApiResponse.send(res, { message: 'Fincas de la zona obtenidas correctamente', data: fincas });
  }),

  assignFinca: asyncHandler(async (req, res) => {
    await zonaService.assignFinca(req.params.uuid, req.body.fincaUuid, req.user?.id);
    ApiResponse.send(res, { message: 'Finca asignada correctamente', data: null });
  }),

  removeFinca: asyncHandler(async (req, res) => {
    await zonaService.removeFinca(req.params.uuid, req.params.fincaUuid);
    ApiResponse.send(res, { message: 'Finca removida correctamente', data: null });
  }),
};

export default zonaController;
