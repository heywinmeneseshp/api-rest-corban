import { resetDatosService } from '../../services/sistema/resetDatos.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const resetDatosController = {
  resetDatosNoSeed: asyncHandler(async (req, res) => {
    const resultado = await resetDatosService.resetDatosNoSeed(req.body.confirmacion);
    ApiResponse.send(res, { message: 'Datos posteriores a la instalación eliminados correctamente', data: resultado });
  }),
};

export default resetDatosController;
