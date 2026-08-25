import { dashboardService } from '../../services/inventario/dashboard.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  resumen: asyncHandler(async (req, res) => {
    const data = await dashboardService.getResumen();
    ApiResponse.send(res, { message: 'Resumen de inventarios obtenido correctamente', data });
  }),
};

export default dashboardController;
