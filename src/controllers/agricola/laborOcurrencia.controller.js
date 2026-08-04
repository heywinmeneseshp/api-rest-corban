import { laborOcurrenciaService } from '../../services/agricola/laborOcurrencia.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const laborOcurrenciaController = {
  list: asyncHandler(async (req, res) => {
    const { items } = await laborOcurrenciaService.listPorAnio(req.query.fincaUuid, req.query.anio, req.user);
    ApiResponse.send(res, { message: 'Ocurrencias obtenidas correctamente', data: { items } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const ocurrencia = await laborOcurrenciaService.getOcurrenciaByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Ocurrencia obtenida correctamente', data: ocurrencia });
  }),

  update: asyncHandler(async (req, res) => {
    const ocurrencia = await laborOcurrenciaService.updateOcurrencia(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Ocurrencia actualizada correctamente', data: ocurrencia });
  }),

  remove: asyncHandler(async (req, res) => {
    await laborOcurrenciaService.deleteOcurrencia(req.params.uuid, req.user?.id, req.user, req.query.alcance);
    ApiResponse.send(res, { message: 'Ocurrencia eliminada correctamente' });
  }),
};

export default laborOcurrenciaController;
