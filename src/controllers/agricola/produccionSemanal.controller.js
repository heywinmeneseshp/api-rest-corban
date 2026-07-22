import { produccionSemanalService } from '../../services/agricola/produccionSemanal.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const produccionSemanalController = {
  list: asyncHandler(async (req, res) => {
    const data = await produccionSemanalService.listProduccion(req.query, req.user);
    ApiResponse.send(res, { message: 'Producción semanal obtenida correctamente', data });
  }),

  bulkUpload: asyncHandler(async (req, res) => {
    const resultado = await produccionSemanalService.bulkCreateProduccion(req.file, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Cargue masivo de producción procesado', data: resultado });
  }),
};

export default produccionSemanalController;
