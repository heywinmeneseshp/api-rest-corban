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
router.put(
  '/rostros/:colaboradorUuid',
  auth,
  permission(PERMISSIONS.COLABORADOR_EDITAR),
  validate(enrolarRostroSchema),
  asyncHandler(async (req, res) => {
    const data = await asistenciaService.enrolarRostro(req.params.colaboradorUuid, req.body, req.user?.id, req.user);
    ApiResponse.send(res, { message: 'Rostro registrado correctamente', data });
  }),
);

router.delete(
  '/rostros/:colaboradorUuid',
  auth,
  permission(PERMISSIONS.COLABORADOR_EDITAR),
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
  permission(PERMISSIONS.ASISTENCIA_VER),
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
  permission(PERMISSIONS.ASISTENCIA_VER),
  validate(jornadasAsistenciaSchema),
  asyncHandler(async (req, res) => {
    ApiResponse.send(res, { message: 'Jornadas obtenidas correctamente', data: await asistenciaService.jornadas(req.query, req.user) });
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
