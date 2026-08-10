import { pronosticoService } from '../../services/agricola/pronostico.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const pronosticoController = {
  get: asyncHandler(async (req, res) => {
    const data = await pronosticoService.getPronostico(req.query, req.user);
    ApiResponse.send(res, { message: 'Pronóstico de cajas calculado correctamente', data });
  }),

  exportar: asyncHandler(async (req, res) => {
    const buffer = await pronosticoService.exportPronosticoToExcel(req.query, req.user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pronostico-${Date.now()}.xlsx"`);
    res.send(buffer);
  }),
};

export default pronosticoController;
