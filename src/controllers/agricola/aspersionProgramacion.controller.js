import { aspersionProgramacionService } from '../../services/agricola/aspersionProgramacion.service.js';
import { configuracionService } from '../../services/sistema/configuracion.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';

export const aspersionProgramacionController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await aspersionProgramacionService.list(req.query);
    ApiResponse.send(res, { message: 'Programaciones de aspersión obtenidas correctamente', data: { items, meta } });
  }),

  getByUuid: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.getByUuid(req.params.uuid);
    ApiResponse.send(res, { message: 'Programación de aspersión obtenida correctamente', data: aspersion });
  }),

  listUsuariosFinca: asyncHandler(async (req, res) => {
    const usuarios = await aspersionProgramacionService.listUsuariosFinca(req.params.fincaUuid);
    ApiResponse.send(res, { message: 'Usuarios de la finca obtenidos correctamente', data: usuarios });
  }),

  create: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.create(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Aspersión programada correctamente', data: aspersion });
  }),

  update: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.update(req.params.uuid, req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Programación de aspersión actualizada correctamente', data: aspersion });
  }),

  actualizarComponente: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.actualizarComponente(
      req.params.uuid,
      req.params.componenteUuid,
      req.body.cantidad,
      req.user?.id,
    );
    ApiResponse.send(res, { message: 'Cantidad del insumo actualizada correctamente', data: aspersion });
  }),

  remove: asyncHandler(async (req, res) => {
    await aspersionProgramacionService.delete(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Programación de aspersión eliminada correctamente' });
  }),

  cancelar: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.cancelar(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Aspersión cancelada correctamente', data: aspersion });
  }),

  ejecutar: asyncHandler(async (req, res) => {
    const resultado = await aspersionProgramacionService.ejecutar(req.params.uuid, req.user?.id, {
      forzarSaldoNegativo: req.body?.forzarSaldoNegativo === true,
    });
    if (resultado.requiereConfirmacion) {
      return ApiResponse.send(res, {
        message: 'Stock insuficiente en uno o más insumos — confirma para continuar',
        data: { requiereConfirmacion: true, advertencias: resultado.advertencias },
      });
    }
    ApiResponse.send(res, {
      message: 'Aspersión ejecutada correctamente (salida de inventario generada)',
      data: { requiereConfirmacion: false, advertencias: [], aspersion: resultado.aspersion },
    });
  }),

  enviarCorreo: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Falta el archivo PDF del aviso');
    const destinatarios = String(req.body.destinatarios || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const aspersion = await aspersionProgramacionService.enviarCorreo(req.params.uuid, {
      destinatarios,
      pdfBuffer: req.file.buffer,
      pdfNombre: req.file.originalname,
    });
    ApiResponse.send(res, { message: 'Aviso enviado por correo correctamente', data: aspersion });
  }),

  // Sugerencia de destinatarios para PRELLENAR el modal de "Enviar aviso por
  // correo" — resuelve la config de Configuración → Destinatarios (roles
  // filtrados por la finca de esta programación + usuarios puntuales +
  // correos sueltos) a una lista real de emails, para que el operador no
  // tenga que escribirlos a mano cada vez (puede seguir editándolos antes
  // de enviar). No requiere ser Administrador — cualquiera con permiso para
  // enviar el correo puede ver a quién le llegaría.
  getDestinatariosSugeridos: asyncHandler(async (req, res) => {
    const aspersion = await aspersionProgramacionService.getByUuid(req.params.uuid);
    const destinatarios = await aspersionProgramacionService.resolverDestinatariosConfigurados(aspersion.fincaId);
    ApiResponse.send(res, { message: 'Destinatarios sugeridos obtenidos correctamente', data: { destinatarios } });
  }),

  getDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.getAspersionDestinatarios();
    ApiResponse.send(res, { message: 'Configuración de destinatarios obtenida correctamente', data });
  }),

  updateDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.setAspersionDestinatarios(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Configuración de destinatarios actualizada correctamente', data });
  }),

  getResumenSemanalDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.getAspersionResumenSemanalDestinatarios();
    ApiResponse.send(res, { message: 'Configuración del resumen semanal obtenida correctamente', data });
  }),

  updateResumenSemanalDestinatarios: asyncHandler(async (req, res) => {
    const data = await configuracionService.setAspersionResumenSemanalDestinatarios(req.body, req.user?.id);
    ApiResponse.send(res, { message: 'Configuración del resumen semanal actualizada correctamente', data });
  }),

  // "Enviar semana" del Calendario: manda el resumen (Excel armado en el
  // navegador) a los destinatarios configurados del resumen semanal.
  enviarResumenSemanal: asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Falta el archivo Excel del resumen');
    if (!req.body.semanaUuid) throw ApiError.badRequest('Indica la semana');
    const resultado = await aspersionProgramacionService.enviarResumenSemanal(req.body.semanaUuid, {
      excelBuffer: req.file.buffer,
      excelNombre: req.file.originalname,
    });
    ApiResponse.send(res, { message: 'Resumen semanal enviado por correo correctamente', data: resultado });
  }),
};

export default aspersionProgramacionController;
