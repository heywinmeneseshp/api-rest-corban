import { Router } from 'express';
import { backupController } from '../../controllers/sistema/backup.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { uploadSqlDump } from '../../middlewares/upload.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { importarBackupSchema } from '../../validators/sistema/backup.validator.js';

const router = Router();

/**
 * @openapi
 * /sistema/backup/export:
 *   get:
 *     tags: [Sistema]
 *     summary: Descarga un dump .sql completo de la base de datos. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo .sql }
 */
router.get('/backup/export', auth, requireAdmin, backupController.exportar);

/**
 * @openapi
 * /sistema/backup/import:
 *   post:
 *     tags: [Sistema]
 *     summary: Reemplaza TODA la base de datos con un dump .sql subido. Destructivo, requiere confirmación exacta. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/backup/import',
  auth,
  requireAdmin,
  uploadSqlDump,
  validate(importarBackupSchema),
  backupController.importar,
);

export default router;
