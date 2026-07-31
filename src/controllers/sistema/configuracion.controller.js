import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const configuracionController = {
  getBanaricaUrl: asyncHandler(async (req, res) => {
    const url = await configuracionService.getBanaricaApiUrl();
    ApiResponse.send(res, { message: 'Configuración obtenida correctamente', data: { url } });
  }),

  updateBanaricaUrl: asyncHandler(async (req, res) => {
    const { valor } = await configuracionService.setBanaricaApiUrl(req.body.url, req.user?.id);
    ApiResponse.send(res, {
      message: 'Enlace de banarica actualizado correctamente',
      data: { url: valor },
    });
  }),

  getAppVersionInfo: asyncHandler(async (req, res) => {
    const data = await configuracionService.getAppVersionInfo();
    ApiResponse.send(res, { message: 'Información de versión obtenida correctamente', data });
  }),

  updateAppVersionInfo: asyncHandler(async (req, res) => {
    const data = await configuracionService.setAppVersionInfo(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Información de versión actualizada correctamente', data });
  }),
};

export default configuracionController;
