import { mezclaService } from '../../services/inventario/mezcla.service.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const mezclaController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await mezclaService.list(req.query);
    ApiResponse.send(res, { message: 'Mezclas obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Mezcla obtenida correctamente', data: mezcla });
  }),

  create: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Mezcla creada correctamente', data: mezcla });
  }),

  update: asyncHandler(async (req, res) => {
    const mezcla = await mezclaService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Mezcla actualizada correctamente', data: mezcla });
  }),

  remove: asyncHandler(async (req, res) => {
    await mezclaService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Mezcla eliminada correctamente' });
  }),

  listHistorial: asyncHandler(async (req, res) => {
    const { items, meta } = await mezclaService.listHistorial(req.query);
    ApiResponse.send(res, { message: 'Historial de pruebas obtenido correctamente', data: { items, meta } });
  }),

  // ─── Prueba de laboratorio ───

  getVersion: asyncHandler(async (req, res) => {
    const version = await mezclaService.getVersionByUuid(req.params.versionUuid);
    ApiResponse.send(res, { message: 'Prueba obtenida correctamente', data: version });
  }),

  setComponentes: asyncHandler(async (req, res) => {
    const version = await mezclaService.setComponentes(req.params.versionUuid, req.body.componentes, req.user?.id);
    ApiResponse.send(res, { message: 'Componentes actualizados correctamente', data: version });
  }),

  agregarEtapa: asyncHandler(async (req, res) => {
    const version = await mezclaService.agregarEtapa(req.params.versionUuid, req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Etapa registrada correctamente', data: version });
  }),

  eliminarEtapa: asyncHandler(async (req, res) => {
    await mezclaService.eliminarEtapa(req.params.etapaUuid);
    ApiResponse.send(res, { message: 'Etapa eliminada correctamente' });
  }),

  subirFotos: asyncHandler(async (req, res) => {
    const version = await mezclaService.subirFotos(req.params.versionUuid, req.files, req.user?.id, req.body?.etapaUuid);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Fotos subidas correctamente', data: version });
  }),

  eliminarFoto: asyncHandler(async (req, res) => {
    await mezclaService.eliminarFoto(req.params.fotoUuid);
    ApiResponse.send(res, { message: 'Foto eliminada correctamente' });
  }),

  obtenerFoto: asyncHandler(async (req, res, next) => {
    try {
      const { stream, mimeType, nombre } = await mezclaService.obtenerContenidoFoto(req.params.fotoUuid);
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${(nombre || 'foto').replace(/"/g, '')}"`);
      stream.on('error', (error) => next(error));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }),

  finalizar: asyncHandler(async (req, res) => {
    const resultado = await mezclaService.finalizar(req.params.versionUuid, req.user?.id, {
      forzarSaldoNegativo: req.body?.forzarSaldoNegativo === true,
    });
    ApiResponse.send(res, {
      message: resultado.requiereConfirmacion ? 'Confirmación requerida' : 'Prueba finalizada correctamente',
      data: resultado,
    });
  }),

  crearElaborado: asyncHandler(async (req, res) => {
    const resultado = await mezclaService.crearElaborado(req.params.versionUuid, req.body, req.user?.id);
    ApiResponse.send(res, {
      statusCode: resultado.requiereConfirmacion ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
      message: resultado.requiereConfirmacion ? 'Confirmación requerida' : 'Elaborado creado correctamente',
      data: resultado,
    });
  }),

  // ─── Parámetros de validación (pH/CE) ───

  getParametros: asyncHandler(async (req, res) => {
    const parametros = await configuracionService.getMezclaParametros();
    ApiResponse.send(res, { message: 'Parámetros obtenidos correctamente', data: parametros });
  }),

  setParametros: asyncHandler(async (req, res) => {
    const parametros = await configuracionService.setMezclaParametros(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Parámetros guardados correctamente', data: parametros });
  }),
};

export default mezclaController;
