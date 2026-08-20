import { Router } from 'express';
import { programacionCorteController } from '../../controllers/agricola/programacionCorte.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireApiKey } from '../../middlewares/requireApiKey.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  syncBanaricaProgramacionSchema,
  webhookSyncProgramacionSchema,
} from '../../validators/agricola/programacionCorte.validator.js';

const router = Router();

/**
 * @openapi
 * /programacion-corte:
 *   get:
 *     tags: [Programación de Corte]
 *     summary: Listar registros de programación de corte
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.PROGRAMACION_CORTE_VER),
  programacionCorteController.list,
);

/**
 * @openapi
 * /programacion-corte/bulk-upload:
 *   post:
 *     tags: [Programación de Corte]
 *     summary: Cargue masivo de programación de corte desde archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.PROGRAMACION_CORTE_CREAR),
  uploadBulkFile,
  programacionCorteController.bulkUpload,
);

/**
 * @openapi
 * /programacion-corte/sync-banarica:
 *   post:
 *     tags: [Programación de Corte]
 *     summary: Sincroniza la programación de corte cargada en Logística (Banarica)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/sync-banarica',
  auth,
  permission(PERMISSIONS.PROGRAMACION_CORTE_CREAR),
  validate(syncBanaricaProgramacionSchema),
  programacionCorteController.syncBanarica,
);

/**
 * @openapi
 * /programacion-corte/webhook-sync-banarica:
 *   post:
 *     tags: [Programación de Corte]
 *     summary: Webhook llamado por api-rest-banarica al cargar una semana — requiere header `api` (CORBANA_API_KEY), no login.
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/webhook-sync-banarica',
  requireApiKey,
  validate(webhookSyncProgramacionSchema),
  programacionCorteController.webhookSync,
);

/**
 * @openapi
 * /programacion-corte/{uuid}:
 *   delete:
 *     tags: [Programación de Corte]
 *     summary: Eliminar un registro de programación de corte (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PROGRAMACION_CORTE_ELIMINAR),
  programacionCorteController.remove,
);

export default router;
