import { ordenServicioExternoService } from '../../services/inventario/ordenServicioExterno.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const ordenServicioController = {
  obtener: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Servicio obtenido correctamente', data: await ordenServicioExternoService.obtener(req.params.uuid) })),
  guardar: asyncHandler(async (req, res) => ApiResponse.send(res, { message: 'Servicio guardado correctamente', data: await ordenServicioExternoService.guardar(req.params.uuid, req.body) })),
  agregarAdjuntos: asyncHandler(async (req, res) =>
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Archivos subidos correctamente', data: await ordenServicioExternoService.agregarAdjuntos(req.params.uuid, req.body || {}, req.files, req.user) })),
  descargarAdjunto: asyncHandler(async (req, res) => {
    const { stream, mimeType, nombre } = await ordenServicioExternoService.descargarAdjunto(req.params.aUuid);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre || 'archivo')}"`);
    stream.pipe(res);
  }),
  eliminarAdjunto: asyncHandler(async (req, res) => {
    await ordenServicioExternoService.eliminarAdjunto(req.params.aUuid);
    ApiResponse.send(res, { message: 'Archivo eliminado correctamente' });
  }),
};

export default ordenServicioController;
