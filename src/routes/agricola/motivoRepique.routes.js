import { Router } from 'express';
import { motivoRepiqueController } from '../../controllers/agricola/motivoRepique.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listMotivosRepiqueSchema,
  getMotivoRepiqueSchema,
  createMotivoRepiqueSchema,
  updateMotivoRepiqueSchema,
} from '../../validators/agricola/motivoRepique.validator.js';

const router = Router();

/**
 * @openapi
 * /motivos-repique:
 *   get:
 *     tags: [Motivos de Repique]
 *     summary: Listar motivos de repique
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Motivos de Repique]
 *     summary: Crear motivo de repique
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_VER),
  validate(listMotivosRepiqueSchema),
  motivoRepiqueController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_CREAR),
  validate(createMotivoRepiqueSchema),
  motivoRepiqueController.create,
);

/**
 * @openapi
 * /motivos-repique/bulk-upload:
 *   post:
 *     tags: [Motivos de Repique]
 *     summary: Cargue masivo de motivos de repique desde un archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_CREAR),
  uploadBulkFile,
  motivoRepiqueController.bulkUpload,
);

/**
 * @openapi
 * /motivos-repique/{uuid}:
 *   get:
 *     tags: [Motivos de Repique]
 *     summary: Obtener motivo de repique por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Motivos de Repique]
 *     summary: Actualizar motivo de repique
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Motivos de Repique]
 *     summary: Eliminar motivo de repique (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_VER),
  validate(getMotivoRepiqueSchema),
  motivoRepiqueController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_EDITAR),
  validate(updateMotivoRepiqueSchema),
  motivoRepiqueController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_REPIQUE_ELIMINAR),
  validate(getMotivoRepiqueSchema),
  motivoRepiqueController.remove,
);

export default router;
