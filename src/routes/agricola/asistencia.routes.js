import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { asistenciaService } from '../../services/agricola/asistencia.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import {
  enrolarRostroSchema,
  borrarRostroSchema,
  rostrosEstadoSchema,
  probarRostroSchema,
  registrarMarcacionesSchema,
  listarAsistenciaSchema,
  jornadasAsistenciaSchema,
  listarLugaresSchema,
  crearLugarSchema,
  actualizarLugarSchema,
  eliminarLugarSchema,
  resolverSolicitudRostroSchema,
  eliminarMarcacionSchema,
} from '../../validators/agricola/asistencia.validator.js';

const router = Router();

// Quien marca (propio o cuadrilla) también necesita ver los colaboradores enrolados de su finca.
const PUEDE_MARCAR = [PERMISSIONS.ASISTENCIA_MARCAR, PERMISSIONS.ASISTENCIA_MARCAR_CUADRILLA];

/**
 * @openapi
 * /asistencia/rostros-estado:
 *   get:
 *     tags: [Asistencia]
 *     summary: Colaboradores y cuántas muestras faciales tiene cada uno
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/rostros-estado',
  auth,
  permission(PERMISSIONS.ASISTENCIA_VER, PERMISSIONS.COLABORADOR_EDITAR, ...PUEDE_MARCAR),
  validate(rostrosEstadoSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Estado de rostros obtenido correctamente', data: await asistenciaService.rostrosEstado(req.query, req.user) });
  }),
);

/**
 * @openapi
 * /asistencia/rostros/{colaboradorUuid}:
 *   put:
 *     tags: [Asistencia]
 *     summary: Enrola (o refuerza) el rostro de un colaborador con los vectores calculados en el dispositivo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Enrolar: el propio rostro (quien marca) o el de otros (quien edita colaboradores); la regla fina está en el servicio.
const PUEDE_ENROLAR = [PERMISSIONS.COLABORADOR_EDITAR, PERMISSIONS.ASISTENCIA_APROBAR_ROSTRO, ...PUEDE_MARCAR];

/**
 * @openapi
 * /asistencia/rostros/solicitudes:
 *   get:
 *     tags: [Asistencia]
 *     summary: Solicitudes pendientes para volver a registrar un rostro (las aprueba otro usuario con permiso)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/rostros/solicitudes',
  auth,
  permission(PERMISSIONS.ASISTENCIA_APROBAR_ROSTRO),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Solicitudes obtenidas correctamente', data: await asistenciaService.listarSolicitudesRostro(req.user) });
  }),
);
for (const [accion, aprobar] of [['aprobar', true], ['rechazar', false]]) {
  router.post(
    `/rostros/solicitudes/:uuid/${accion}`,
    auth,
    permission(PERMISSIONS.ASISTENCIA_APROBAR_ROSTRO),
    validate(resolverSolicitudRostroSchema),
    asyncHandler(async (req, res) => {
      const data = await asistenciaService.resolverSolicitudRostro(req.params.uuid, { aprobar, nota: req.body.nota }, req.user);
      ApiResponse.send(res, { message: aprobar ? 'Nuevo registro de rostro aprobado' : 'Solicitud rechazada', data });
    }),
  );
}

router.put(
  '/rostros/:colaboradorUuid',
  auth,
  permission(...PUEDE_ENROLAR),
  validate(enrolarRostroSchema),
  asyncHandler(async (req, res) => {
    const data = await asistenciaService.enrolarRostro(req.params.colaboradorUuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: data.solicitud ? 'Nuevo registro enviado: queda pendiente de aprobación' : 'Rostro registrado correctamente', data });
  }),
);

router.delete(
  '/rostros/:colaboradorUuid',
  auth,
  permission(PERMISSIONS.ASISTENCIA_APROBAR_ROSTRO),
  validate(borrarRostroSchema),
  asyncHandler(async (req, res) => {
    await asistenciaService.borrarRostro(req.params.colaboradorUuid, req.user);
    ApiResponse.send(res, { message: 'Rostro eliminado correctamente', data: {} });
  }),
);

/**
 * @openapi
 * /asistencia/probar:
 *   post:
 *     tags: [Asistencia]
 *     summary: "Prueba de reconocimiento (piloto): identifica sin guardar nada"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/probar',
  auth,
  permission(PERMISSIONS.ASISTENCIA_MARCAR_CUADRILLA),
  validate(probarRostroSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Prueba de reconocimiento realizada', data: await asistenciaService.probar(req.body, req.user) });
  }),
);

/**
 * @openapi
 * /asistencia/marcaciones:
 *   post:
 *     tags: [Asistencia]
 *     summary: Registra marcaciones (lote, idempotente por uuid) verificadas por rostro
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Procesadas }
 */
router.post(
  '/marcaciones',
  auth,
  permission(...PUEDE_MARCAR),
  validate(registrarMarcacionesSchema),
  asyncHandler(async (req, res) => {
    const data = await asistenciaService.registrarMarcaciones(req.body.marcaciones, req.user?.id, req.user);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Marcaciones de asistencia procesadas', data });
  }),
);

/**
 * @openapi
 * /asistencia:
 *   get:
 *     tags: [Asistencia]
 *     summary: Listado de marcaciones de asistencia
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.ASISTENCIA_VER, ...PUEDE_MARCAR), // quien solo marca ve únicamente lo suyo
  validate(listarAsistenciaSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Asistencia obtenida correctamente', data: await asistenciaService.listar(req.query, req.user) });
  }),
);

/**
 * @openapi
 * /asistencia/jornadas:
 *   get:
 *     tags: [Asistencia]
 *     summary: Jornadas por colaborador y día (estancias por finca y tránsito entre fincas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/jornadas',
  auth,
  permission(PERMISSIONS.ASISTENCIA_VER, ...PUEDE_MARCAR), // quien solo marca ve únicamente lo suyo
  validate(jornadasAsistenciaSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Jornadas obtenidas correctamente', data: await asistenciaService.jornadas(req.query, req.user) });
  }),
);

/**
 * @openapi
 * /asistencia/lugares:
 *   get:
 *     tags: [Asistencia]
 *     summary: Lugares de asistencia distintos de las fincas (oficinas, plantas...)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/lugares',
  auth,
  permission(PERMISSIONS.ASISTENCIA_VER, PERMISSIONS.ASISTENCIA_LUGARES, ...PUEDE_MARCAR),
  validate(listarLugaresSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Lugares obtenidos correctamente', data: await asistenciaService.listarLugares(req.query) });
  }),
);
router.post(
  '/lugares',
  auth,
  permission(PERMISSIONS.ASISTENCIA_LUGARES),
  validate(crearLugarSchema),
  asyncHandler(async (req, res) => {
    const data = await asistenciaService.crearLugar(req.body, req.user?.id);
    ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Lugar creado correctamente', data });
  }),
);
router.put(
  '/lugares/:uuid',
  auth,
  permission(PERMISSIONS.ASISTENCIA_LUGARES),
  validate(actualizarLugarSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Lugar actualizado correctamente', data: await asistenciaService.actualizarLugar(req.params.uuid, req.body, req.user?.id) });
  }),
);
router.delete(
  '/lugares/:uuid',
  auth,
  permission(PERMISSIONS.ASISTENCIA_LUGARES),
  validate(eliminarLugarSchema),
  asyncHandler(async (req, res) => {
    await asistenciaService.eliminarLugar(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Lugar eliminado correctamente', data: {} });
  }),
);

router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ASISTENCIA_ELIMINAR),
  validate(eliminarMarcacionSchema),
  asyncHandler(async (req, res) => {
    await asistenciaService.eliminar(req.params.uuid, req.user?.id);
    ApiResponse.send(res, { message: 'Marcación eliminada correctamente', data: {} });
  }),
);

export default router;
