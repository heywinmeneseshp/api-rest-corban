import { dashboardService } from '../../services/agricola/dashboard.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  resumen: asyncHandler(async (req, res) => {
    const data = await dashboardService.getResumen(req.query, req.user);
    ApiResponse.send(res, { message: 'Resumen del dashboard obtenido correctamente', data });
  }),
};

export default dashboardController;
