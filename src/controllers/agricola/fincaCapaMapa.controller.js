import { fincaCapaMapaService } from '../../services/agricola/fincaCapaMapa.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const fincaCapaMapaController = {
  list: asyncHandler(async (req, res) => {
    const data = await fincaCapaMapaService.list(req.params.uuid, req.query, req.user);
    ApiResponse.send(res, { message: 'Capas de mapa obtenidas correctamente', data });
  }),

  reemplazar: asyncHandler(async (req, res) => {
    const data = await fincaCapaMapaService.reemplazar(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Capa de mapa guardada correctamente', data });
  }),

  borrar: asyncHandler(async (req, res) => {
    await fincaCapaMapaService.borrar(req.params.uuid, req.query, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Capa de mapa eliminada correctamente' });
  }),
};

export default fincaCapaMapaController;
