import { evaluacionService } from '../../services/agricola/evaluacion.service.js';
import { objetivoEvaluacionService } from '../../services/agricola/objetivoEvaluacion.service.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const evaluacionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await evaluacionService.listEvaluaciones(req.query, req.user);
    ApiResponse.send(res, { message: 'Evaluaciones obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.getEvaluacionByUuid(req.params.uuid, req.user);
    ApiResponse.send(res, { message: 'Evaluación obtenida correctamente', data: evaluacion });
  }),

  create: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.createEvaluacion(req.body, req.user?.id, req.user);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Evaluación creada correctamente',
      data: evaluacion,
    });
  }),

  update: asyncHandler(async (req, res) => {
    const evaluacion = await evaluacionService.updateEvaluacion(req.params.uuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Evaluación actualizada correctamente', data: evaluacion });
  }),

  remove: asyncHandler(async (req, res) => {
    await evaluacionService.deleteEvaluacion(req.params.uuid, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Evaluación anulada correctamente' });
  }),

  promedioSumaBruta: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioSumaBrutaPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de suma bruta por semana obtenido correctamente',
      data: { items },
    });
  }),

  promedioSumaBrutaPorHoja: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioSumaBrutaPorHoja(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de suma bruta por hoja obtenido correctamente',
      data: { items },
    });
  }),

  promedioConteo: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioConteoPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de conteo de hojas por semana obtenido correctamente',
      data: { items },
    });
  }),

  promedioInfeccion: asyncHandler(async (req, res) => {
    const items = await evaluacionService.promedioInfeccionPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Promedio de índice de infección por semana obtenido correctamente',
      data: { items },
    });
  }),

  alertasSemana: asyncHandler(async (req, res) => {
    const result = await evaluacionService.alertasSemanaCerrada(req.query, req.user);
    ApiResponse.send(res, { message: 'Alertas de la última semana cerrada obtenidas correctamente', data: result });
  }),

  // Botón "Enviar ahora" del panel — dispara el mismo envío que hace el cron
  // semanal, para la semana que se esté viendo (o la última cerrada si no
  // se manda semanaUuid). Solo Administrador (ver routes).
  enviarAlertasManual: asyncHandler(async (req, res) => {
    const result = await evaluacionService.enviarAlertasSemanaCerrada(req.body || {});
    ApiResponse.send(res, {
      message: result.enviado
        ? `Correo de alertas enviado a ${result.destinatarios.length} destinatario(s)`
        : result.alertas.length === 0
          ? 'No hay alertas en esa semana — no se envió ningún correo'
          : 'No hay destinatarios configurados — no se envió ningún correo',
      data: result,
    });
  }),

  getAlertasDestinatarios: asyncHandler(async (req, res) => {
    const destinatarios = await configuracionService.getAlertasSanidadDestinatarios();
    ApiResponse.send(res, { message: 'Destinatarios de alertas obtenidos correctamente', data: destinatarios });
  }),

  setAlertasDestinatarios: asyncHandler(async (req, res) => {
    const destinatarios = await configuracionService.setAlertasSanidadDestinatarios(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Destinatarios de alertas guardados correctamente', data: destinatarios });
  }),

  getSbHojaUmbrales: asyncHandler(async (req, res) => {
    const umbrales = await configuracionService.getSbHojaUmbrales();
    ApiResponse.send(res, { message: 'Umbrales de Suma Bruta por Hoja obtenidos correctamente', data: umbrales });
  }),

  setSbHojaUmbrales: asyncHandler(async (req, res) => {
    const umbrales = await configuracionService.setSbHojaUmbrales(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Umbrales de Suma Bruta por Hoja guardados correctamente', data: umbrales });
  }),

  indicadores: asyncHandler(async (req, res) => {
    const data = await evaluacionService.indicadoresPorSemana(req.query, req.user);
    ApiResponse.send(res, {
      message: 'Indicadores de evaluaciones obtenidos correctamente',
      data,
    });
  }),

  listObjetivos: asyncHandler(async (req, res) => {
    const { items, meta } = await objetivoEvaluacionService.listObjetivos(req.query);
    ApiResponse.send(res, { message: 'Objetivos de evaluación obtenidos correctamente', data: { items, meta } });
  }),

  getObjetivoByUuid: asyncHandler(async (req, res) => {
    const objetivo = await objetivoEvaluacionService.getObjetivoByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Objetivo de evaluación obtenido correctamente', data: objetivo });
  }),

  createObjetivo: asyncHandler(async (req, res) => {
    const objetivo = await objetivoEvaluacionService.createObjetivo(req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Objetivo de evaluación creado correctamente',
      data: objetivo,
    });
  }),

  updateObjetivo: asyncHandler(async (req, res) => {
    const objetivo = await objetivoEvaluacionService.updateObjetivo(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Objetivo de evaluación actualizado correctamente', data: objetivo });
  }),

  removeObjetivo: asyncHandler(async (req, res) => {
    await objetivoEvaluacionService.deleteObjetivo(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Objetivo de evaluación eliminado correctamente' });
  }),

  progresoObjetivos: asyncHandler(async (req, res) => {
    const data = await objetivoEvaluacionService.progreso(req.query, req.user);
    ApiResponse.send(res, { message: 'Progreso de objetivos obtenido correctamente', data });
  }),
};

export default evaluacionController;
