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
