import { Router } from 'express';
import { produccionSemanalController } from '../../controllers/agricola/produccionSemanal.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';

const router = Router();

/**
 * @openapi
 * /produccion-semanal:
 *   get:
 *     tags: [Producción Semanal]
 *     summary: Listar registros de producción semanal
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.PRODUCCION_VER),
  produccionSemanalController.list,
);

/**
 * @openapi
 * /produccion-semanal/bulk-upload:
 *   post:
 *     tags: [Producción Semanal]
 *     summary: Cargue masivo de producción semanal desde archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.PRODUCCION_CREAR),
  uploadBulkFile,
  produccionSemanalController.bulkUpload,
);

export default router;
