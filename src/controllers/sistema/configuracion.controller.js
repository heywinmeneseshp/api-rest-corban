import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { programacionCorteService } from '../../services/agricola/programacionCorte.service.js';
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

  getLogistica: asyncHandler(async (req, res) => {
    const [url, apiKey] = await Promise.all([
      configuracionService.getBanaricaApiUrl(),
      configuracionService.getBanaricaApiKey(),
    ]);
    // La API key nunca se devuelve completa al frontend, solo si ya hay una guardada.
    ApiResponse.send(res, {
      message: 'Configuración obtenida correctamente',
      data: { url, hasApiKey: Boolean(apiKey) },
    });
  }),

  updateLogistica: asyncHandler(async (req, res) => {
    await configuracionService.setBanaricaApiUrl(req.body.url, req.user?.id);
    // La API key es opcional al actualizar: si viene vacía, se conserva la
    // que ya estaba guardada (así el formulario no obliga a reescribirla
    // cada vez que solo se corrige el enlace).
    let apiKey = await configuracionService.getBanaricaApiKey();
    if (req.body.apiKey) {
      apiKey = await configuracionService.setBanaricaApiKey(req.body.apiKey, req.user?.id);
    }
    ApiResponse.send(res, {
      message: 'Conexión con Logística actualizada correctamente',
      data: { url: req.body.url, hasApiKey: Boolean(apiKey) },
    });
  }),

  getTasaConversion: asyncHandler(async (req, res) => {
    const peso = await configuracionService.getTasaConversion();
    ApiResponse.send(res, { message: 'Configuración obtenida correctamente', data: { peso } });
  }),

  updateTasaConversion: asyncHandler(async (req, res) => {
    const peso = await configuracionService.setTasaConversion(req.body.peso, req.user?.id);
    // Recalcula toda la Producción Semanal ya calculada con la tasa nueva
    // (una sola consulta agregada + un único upsert, ver
    // programacionCorteService.recalcularTodaProduccionSemanal).
    await programacionCorteService.recalcularTodaProduccionSemanal(req.user?.id);
    ApiResponse.send(res, { message: 'Tasa de conversión actualizada correctamente', data: { peso } });
  }),

  getAppVersionInfo: asyncHandler(async (req, res) => {
    const data = await configuracionService.getAppVersionInfo();
    ApiResponse.send(res, { message: 'Información de versión obtenida correctamente', data });
  }),

  updateAppVersionInfo: asyncHandler(async (req, res) => {
    const data = await configuracionService.setAppVersionInfo(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Información de versión actualizada correctamente', data });
  }),

  getMarcaApp: asyncHandler(async (req, res) => {
    const data = await configuracionService.getMarcaApp();
    ApiResponse.send(res, { message: 'Marca de la app obtenida correctamente', data });
  }),

  updateMarcaApp: asyncHandler(async (req, res) => {
    const data = await configuracionService.setMarcaApp(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Marca de la app actualizada correctamente', data });
  }),
};

export default configuracionController;
