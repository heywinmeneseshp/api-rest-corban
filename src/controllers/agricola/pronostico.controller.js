import { pronosticoService } from '../../services/agricola/pronostico.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const pronosticoController = {
  get: asyncHandler(async (req, res) => {
    const data = await pronosticoService.getPronostico(req.query, req.user);
    ApiResponse.send(res, { message: 'Pronóstico de cajas calculado correctamente', data });
  }),

  guardarRatioManual: asyncHandler(async (req, res) => {
    const data = await pronosticoService.guardarRatioManual(req.body, req.user?.id);
    ApiResponse.send(res, { message: data.ratio == null ? 'Ratio restablecido' : 'Ratio guardado', data });
  }),

  guardarCajasProyectada: asyncHandler(async (req, res) => {
    const data = await pronosticoService.guardarCajasProyectada(req.body, req.user?.id);
    ApiResponse.send(res, { message: data.cajas == null ? 'Proyectada restablecida' : 'Proyectada guardada', data });
  }),

  guardarCajasAdicionales: asyncHandler(async (req, res) => {
    const data = await pronosticoService.guardarCajasAdicionales(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Cajas adicionales guardadas', data });
  }),

  exportar: asyncHandler(async (req, res) => {
    const buffer = await pronosticoService.exportPronosticoToExcel(req.query, req.user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pronostico-${Date.now()}.xlsx"`);
    res.send(buffer);
  }),
};

export default pronosticoController;
