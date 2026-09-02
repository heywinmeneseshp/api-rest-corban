import { Router } from 'express';
import { estimacionFincaController } from '../../controllers/agricola/estimacionFinca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listarEstimacionesSchema,
  guardarEstimacionesSchema,
  obtenerSemanasSchema,
  eliminarEstimacionSchema,
  obtenerEscaleraSchema,
  obtenerComparativoSchema,
} from '../../validators/agricola/estimacionFinca.validator.js';

const router = Router();

/**
 * @openapi
 * /estimaciones/semanas:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Próximas semanas a estimar + fincas habilitadas + tasa de conversión
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/semanas',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER),
  validate(obtenerSemanasSchema),
  estimacionFincaController.getSemanas,
);

router.get(
  '/escalera',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER),
  validate(obtenerEscaleraSchema),
  estimacionFincaController.escalera,
);

/**
 * @openapi
 * /estimaciones/comparativo:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Compara lo estimado contra lo realmente producido (Producción Semanal), por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/comparativo',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER),
  validate(obtenerComparativoSchema),
  estimacionFincaController.comparativo,
);

router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.ESTIMACION_CREAR),
  uploadBulkFile,
  estimacionFincaController.bulkUpload,
);

router.post(
  '/bulk-update',
  auth,
  permission(PERMISSIONS.ESTIMACION_ACTUALIZAR_MASIVO),
  uploadBulkFile,
  estimacionFincaController.bulkUpdate,
);

/**
 * @openapi
 * /estimaciones:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Listar estimaciones de cajas por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Guardar (crear/editar) estimaciones de cajas por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER),
  validate(listarEstimacionesSchema),
  estimacionFincaController.list,
);

router.post(
  '/',
  auth,
  permission(PERMISSIONS.ESTIMACION_CREAR),
  validate(guardarEstimacionesSchema),
  estimacionFincaController.save,
);

/**
 * @openapi
 * /estimaciones/{uuid}:
 *   delete:
 *     tags: [Estimaciones de Fincas]
 *     summary: Eliminar una estimación (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ESTIMACION_ELIMINAR),
  validate(eliminarEstimacionSchema),
  estimacionFincaController.remove,
);

export default router;
