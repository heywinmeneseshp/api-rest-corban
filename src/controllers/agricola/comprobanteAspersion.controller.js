import { comprobanteAspersionService } from '../../services/agricola/comprobanteAspersion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const comprobanteAspersionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await comprobanteAspersionService.list(req.query, req.user);
    ApiResponse.send(res, { message: 'Comprobantes de aspersión obtenidos correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.getByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión obtenido correctamente', data: comprobante });
  }),

  update: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.update(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión actualizado correctamente', data: comprobante });
  }),

  emitir: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.emitir(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión emitido correctamente', data: comprobante });
  }),

  subirKml: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.subirKml(req.params.uuid, req.file, req.body?.geometria, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Recorrido (KML) guardado', data: comprobante });
  }),

  quitarKml: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Recorrido (KML) quitado', data: await comprobanteAspersionService.quitarKml(req.params.uuid, req.user?.id, req.user) });
  }),

  descargarKml: asyncHandler(async (req, res) => {
    const { texto, nombre } = await comprobanteAspersionService.descargarKml(req.params.uuid, req.user);
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre.replace(/"/g, '')}"`);
    res.send(texto);
  }),

  participantesDisponibles: asyncHandler(async (_req, res) => {
    ApiResponse.send(res, { message: 'Pilotos y asistentes disponibles', data: await comprobanteAspersionService.participantesDisponibles() });
  }),

  reporteHectareas: asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Hectáreas asperjadas por colaborador', data: await comprobanteAspersionService.reporteHectareas(req.query, req.user) });
  }),

  anular: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.anular(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Comprobante de aspersión anulado correctamente', data: comprobante });
  }),

  regenerar: asyncHandler(async (req, res) => {
    const comprobante = await comprobanteAspersionService.regenerar(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Borrador de comprobante regenerado correctamente', data: comprobante });
  }),
};

export default comprobanteAspersionController;
