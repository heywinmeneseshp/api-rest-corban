import { ucEmbolseService } from '../../services/agricola/ucEmbolse.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const ucEmbolseController = {
  opciones: asyncHandler(async (req, res) => {
    const data = await ucEmbolseService.opciones(req.user);
    ApiResponse.send(res, { message: 'Opciones de UC por embolse obtenidas correctamente', data });
  }),

  calcular: asyncHandler(async (req, res) => {
    const data = await ucEmbolseService.calcular(req.query, req.user);
    ApiResponse.send(res, { message: 'UC acumuladas por embolse calculadas correctamente', data });
  }),
};

export default ucEmbolseController;
