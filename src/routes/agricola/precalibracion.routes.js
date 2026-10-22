import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { precalibracionService } from '../../services/agricola/precalibracion.service.js';
import { precalibracionConfigService } from '../../services/agricola/precalibracionConfig.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.constants.js';
import {
  opcionesPrecalibracionSchema,
  resumenPrecalibracionSchema,
  detalleLotePrecalibracionSchema,
  registrarPrecalibracionSchema,
  cerrarSesionPrecalibracionSchema,
  sesionesPrecalibracionSchema,
  trazaSesionPrecalibracionSchema,
  getTrazaSesionPrecalibracionSchema,
  rendimientoPrecalibracionSchema,
  semanalPrecalibracionSchema,
  importarPrecalibracionSchema,
  guardarEstimacionPrecalibracionSchema,
  guardarConfigPrecalibracionSchema,
  configPrecalibracionVaciaSchema,
  restablecerConfigFincaSchema,
} from '../../validators/agricola/precalibracion.validator.js';

const router = Router();

/**
 * @openapi
 * /precalibracion/opciones:
 *   get:
 *     tags: [Precalibración]
 *     summary: Catálogos para los filtros (fincas, lotes, semanas, valores del calibrador y cintas de hoy)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/opciones', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(opcionesPrecalibracionSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Opciones de precalibración obtenidas correctamente', data: await precalibracionService.getOpciones(req.user) });
}));

/**
 * @openapi
 * /precalibracion/resumen:
 *   get:
 *     tags: [Precalibración]
 *     summary: Dashboard de precalibración (KPIs, tabla por lote, distribución, ratio y potencial)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/resumen', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(resumenPrecalibracionSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Resumen de precalibración obtenido correctamente', data: await precalibracionService.getResumen(req.query, req.user) });
}));

/**
 * @openapi
 * /precalibracion/lotes/{loteUuid}/detalle:
 *   get:
 *     tags: [Precalibración]
 *     summary: Detalle de un lote (aptos, saldo y restante por cinta, y registros con GPS)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/lotes/:loteUuid/detalle', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(detalleLotePrecalibracionSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, {
    message: 'Detalle de precalibración del lote obtenido correctamente',
    data: await precalibracionService.getDetalleLote(req.params.loteUuid, req.query, req.user),
  });
}));

/**
 * @openapi
 * /precalibracion/registros:
 *   post:
 *     tags: [Precalibración]
 *     summary: Registra racimos aptos desde la app móvil (idempotente por uuid)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.post('/registros', auth, permission(PERMISSIONS.PRECALIBRACION_CREAR), validate(registrarPrecalibracionSchema), asyncHandler(async (req, res) => {
  const resultado = await precalibracionService.registrar(req.body, req.user?.id, req.user);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Registros de precalibración procesados', data: resultado });
}));

/**
 * @openapi
 * /precalibracion/sesiones/{uuid}/cerrar:
 *   post:
 *     tags: [Precalibración]
 *     summary: Cierra una sesión de precalibración y guarda su potencial de cosecha
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 * /precalibracion/sesiones:
 *   get:
 *     tags: [Precalibración]
 *     summary: Sesiones de precalibración con racimos aptos por edad, hectáreas, horas, duración y recorrido
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post('/sesiones/:uuid/cerrar', auth, permission(PERMISSIONS.PRECALIBRACION_CREAR), validate(cerrarSesionPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.cerrarSesion(req.params.uuid, req.body, req.user?.id, req.user);
  ApiResponse.send(res, { message: 'Sesión de precalibración cerrada', data });
}));
router.post('/sesiones/:uuid/traza', auth, permission(PERMISSIONS.PRECALIBRACION_CREAR), validate(trazaSesionPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.subirTraza(req.params.uuid, req.body.puntos, req.user);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Traza de la sesión recibida', data });
}));
router.get('/sesiones/:uuid/traza', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(getTrazaSesionPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.getTrazaSesion(req.params.uuid, req.user);
  ApiResponse.send(res, { message: 'Traza de la sesión obtenida correctamente', data });
}));
router.post('/importar', auth, permission(PERMISSIONS.PRECALIBRACION_CREAR), validate(importarPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.importarExcel(req.body, req.user?.id, req.user);
  ApiResponse.send(res, { message: req.body.simular ? 'Archivo validado' : 'Precalibración importada', data });
}));
router.get('/rendimiento', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(rendimientoPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.getRendimiento(req.query, req.user);
  ApiResponse.send(res, { message: 'Rendimiento de precalibración obtenido correctamente', data });
}));
router.get('/semanal', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(semanalPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.getSemanal(req.query, req.user);
  ApiResponse.send(res, { message: 'Resumen semanal de precalibración obtenido correctamente', data });
}));
router.get('/sesiones', auth, permission(PERMISSIONS.PRECALIBRACION_VER), validate(sesionesPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.getSesiones(req.query, req.user);
  ApiResponse.send(res, { message: 'Sesiones de precalibración obtenidas correctamente', data });
}));

/**
 * @openapi
 * /precalibracion/estimaciones:
 *   post:
 *     tags: [Precalibración]
 *     summary: Guarda un ajuste de estimación (cajas y ratio) de la semana de precalibración, sin tocar la escalera
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.post('/estimaciones', auth, permission(PERMISSIONS.PRECALIBRACION_CREAR), validate(guardarEstimacionPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionService.guardarEstimacion(req.body, req.user?.id, req.user);
  ApiResponse.send(res, { statusCode: HTTP_STATUS.CREATED, message: 'Ajuste de estimación guardado', data });
}));

/**
 * @openapi
 * /precalibracion/configuracion:
 *   get:
 *     tags: [Precalibración]
 *     summary: "Configuración (edades y calibres): global y por finca"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Precalibración]
 *     summary: Guarda la configuración global o de una finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/configuracion', auth, permission(PERMISSIONS.PRECALIBRACION_CONFIGURAR), validate(configPrecalibracionVaciaSchema), asyncHandler(async (req, res) => {
  ApiResponse.send(res, { message: 'Configuración de precalibración obtenida correctamente', data: await precalibracionConfigService.getConfiguracion(req.user) });
}));

router.put('/configuracion', auth, permission(PERMISSIONS.PRECALIBRACION_CONFIGURAR), validate(guardarConfigPrecalibracionSchema), asyncHandler(async (req, res) => {
  const data = await precalibracionConfigService.guardar(req.body, req.user?.id, req.user);
  ApiResponse.send(res, { message: 'Configuración de precalibración guardada', data });
}));

router.delete('/configuracion/:fincaUuid', auth, permission(PERMISSIONS.PRECALIBRACION_CONFIGURAR), validate(restablecerConfigFincaSchema), asyncHandler(async (req, res) => {
  await precalibracionConfigService.restablecerFinca(req.params.fincaUuid, req.user);
  ApiResponse.send(res, { message: 'La finca vuelve a usar la configuración global', data: {} });
}));

export default router;
