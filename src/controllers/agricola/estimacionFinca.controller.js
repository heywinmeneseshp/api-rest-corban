import { estimacionFincaService } from '../../services/agricola/estimacionFinca.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const estimacionFincaController = {
  // Próximas semanas a estimar + fincas habilitadas + tasa de conversión.
  getSemanas: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.getSemanasAEstimar(req.query, req.user);
    ApiResponse.send(res, { message: 'Semanas a estimar obtenidas correctamente', data });
  }),

  list: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.listarEstimaciones(req.query, req.user);
    ApiResponse.send(res, { message: 'Estimaciones obtenidas correctamente', data });
  }),

  save: asyncHandler(async (req, res) => {
    const resultado = await estimacionFincaService.guardarEstimaciones(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Estimaciones guardadas correctamente', data: resultado });
  }),

  remove: asyncHandler(async (req, res) => {
    await estimacionFincaService.eliminarEstimacion(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Estimación eliminada correctamente' });
  }),

  escalera: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.getEscalera(req.query, req.user);
    ApiResponse.send(res, { message: 'Vista escalera obtenida correctamente', data });
  }),

  comparativo: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.getComparativo(req.query, req.user);
    ApiResponse.send(res, { message: 'Comparativo estimado vs. real obtenido correctamente', data });
  }),

  exportarComparativo: asyncHandler(async (req, res) => {
    const buffer = await estimacionFincaService.exportComparativoToExcel(req.query, req.user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="comparativo-estimado-vs-real-${Date.now()}.xlsx"`);
    res.send(buffer);
  }),

  resumenFinca: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.getResumenFinca(req.query, req.user);
    ApiResponse.send(res, { message: 'Resumen de racimos de la finca obtenido correctamente', data });
  }),

  liquidarSemana: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.liquidarSemana(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Semana liquidada correctamente', data });
  }),

  quitarLiquidacionSemana: asyncHandler(async (req, res) => {
    await estimacionFincaService.quitarLiquidacionSemana(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Liquidación de semana eliminada correctamente' });
  }),

  guardarPatronCortePct: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.guardarPatronCortePct(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Porcentajes guardados correctamente', data });
  }),

  guardarRatioCajasPorSemana: asyncHandler(async (req, res) => {
    const data = await estimacionFincaService.guardarRatioCajasPorSemana(req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Ratios guardados correctamente', data });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const resultado = await estimacionFincaService.bulkCreateEstimaciones(req.file, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Cargue masivo de estimaciones procesado', data: resultado });
  }),

  bulkUpdate: asyncHandler(async (req, res) => {
    const resultado = await estimacionFincaService.bulkUpdateEstimaciones(req.file, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Actualización masiva de estimaciones procesada', data: resultado });
  }),
};

export default estimacionFincaController;
