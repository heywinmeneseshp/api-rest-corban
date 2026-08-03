import { Router } from 'express';
import { loteController } from '../../controllers/agricola/lote.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listLotesSchema,
  getLoteSchema,
  createLoteSchema,
  updateLoteSchema,
  listLotePlantasSchema,
  listAreaProduccionSchema,
  createAreaProduccionSchema,
} from '../../validators/agricola/lote.validator.js';

const router = Router();

/**
 * @openapi
 * /lotes:
 *   get:
 *     tags: [Lotes]
 *     summary: Listar lotes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Lotes]
 *     summary: Crear lote
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.LOTE_VER), validate(listLotesSchema), loteController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.LOTE_CREAR),
  validate(createLoteSchema),
  loteController.create,
);

/**
 * @openapi
 * /lotes/{uuid}:
 *   get:
 *     tags: [Lotes]
 *     summary: Obtener lote por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Lotes]
 *     summary: Actualizar lote
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Lotes]
 *     summary: Eliminar lote (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LOTE_VER),
  validate(getLoteSchema),
  loteController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LOTE_EDITAR),
  validate(updateLoteSchema),
  loteController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LOTE_ELIMINAR),
  validate(getLoteSchema),
  loteController.remove,
);

/**
 * @openapi
 * /lotes/{uuid}/restore:
 *   post:
 *     tags: [Lotes]
 *     summary: Restaurar un lote eliminado (solo Administrador)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/:uuid/restore',
  auth,
  permission(PERMISSIONS.LOTE_ELIMINAR),
  validate(getLoteSchema),
  loteController.restore,
);

/**
 * @openapi
 * /lotes/{uuid}/plantas:
 *   get:
 *     tags: [Lotes]
 *     summary: Listar plantas de un lote
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/plantas',
  auth,
  permission(PERMISSIONS.PLANTA_VER),
  validate(listLotePlantasSchema),
  loteController.listPlantas,
);

/**
 * @openapi
 * /lotes/{uuid}/area-produccion:
 *   get:
 *     tags: [Lotes]
 *     summary: Historial de área en producción de un lote
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Lotes]
 *     summary: Registrar una nueva medición de área en producción
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/:uuid/area-produccion',
  auth,
  permission(PERMISSIONS.LOTE_VER),
  validate(listAreaProduccionSchema),
  loteController.listAreaProduccion,
);
router.post(
  '/:uuid/area-produccion',
  auth,
  permission(PERMISSIONS.LOTE_EDITAR),
  validate(createAreaProduccionSchema),
  loteController.registerAreaProduccion,
);

/**
 * @openapi
 * /lotes/bulk-upload:
 *   post:
 *     tags: [Lotes]
 *     summary: Cargue masivo de lotes desde un archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.LOTE_CREAR),
  uploadBulkFile,
  loteController.bulkUpload,
);

export default router;
