import { dashboardService } from '../../services/agricola/dashboard.service.js';
import { alertasService } from '../../services/agricola/alertas.service.js';
import { informeSemanalService } from '../../services/agricola/informeSemanal.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  resumen: asyncHandler(async (req, res) => {
    const data = await dashboardService.getResumen(req.query, req.user);
    ApiResponse.send(res, { message: 'Resumen del dashboard obtenido correctamente', data });
  }),
  informeSemanal: asyncHandler(async (req, res) => {
    if (!req.query.fincaUuid) throw ApiError.badRequest('Debes indicar la finca');
    const data = await informeSemanalService.generar({ fincaUuid: req.query.fincaUuid, semanaUuid: req.query.semanaUuid || null }, req.user);
    ApiResponse.send(res, { message: 'Informe semanal obtenido correctamente', data });
  }),
  getInformeSemanalDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.getInformeSemanalDestinatarios();
    ApiResponse.send(res, { message: 'Destinatarios obtenidos correctamente', data });
  }),
  updateInformeSemanalDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.setInformeSemanalDestinatarios(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Destinatarios guardados correctamente', data });
  }),
  enviarInformeSemanal: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Falta el PDF del informe');
    if (!req.body.fincaUuid) throw ApiError.badRequest('Indica la finca');
    const data = await informeSemanalService.enviar(
      { fincaUuid: req.body.fincaUuid, semanaUuid: req.body.semanaUuid || null, pdfBuffer: req.file.buffer, pdfNombre: req.file.originalname },
      req.user,
    );
    ApiResponse.send(res, { message: 'Informe enviado por correo correctamente', data });
  }),
  alertas: asyncHandler(async (req, res) => {
    const data = await alertasService.centro(req.user);
    ApiResponse.send(res, { message: 'Alertas obtenidas correctamente', data });
  }),
};

export default dashboardController;
