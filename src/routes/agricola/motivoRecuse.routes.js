import { Router } from 'express';
import { motivoRecuseController } from '../../controllers/agricola/motivoRecuse.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listMotivosRecuseSchema,
  getMotivoRecuseSchema,
  createMotivoRecuseSchema,
  updateMotivoRecuseSchema,
} from '../../validators/agricola/motivoRecuse.validator.js';

const router = Router();

/**
 * @openapi
 * /motivos-recuse:
 *   get:
 *     tags: [Motivos de Recuse]
 *     summary: Listar motivos de recuse
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Motivos de Recuse]
 *     summary: Crear motivo de recuse
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.MOTIVO_RECUSE_VER),
  validate(listMotivosRecuseSchema),
  motivoRecuseController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.MOTIVO_RECUSE_CREAR),
  validate(createMotivoRecuseSchema),
  motivoRecuseController.create,
);

/**
 * @openapi
 * /motivos-recuse/{uuid}:
 *   get:
 *     tags: [Motivos de Recuse]
 *     summary: Obtener motivo de recuse por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Motivos de Recuse]
 *     summary: Actualizar motivo de recuse
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Motivos de Recuse]
 *     summary: Eliminar motivo de recuse (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_RECUSE_VER),
  validate(getMotivoRecuseSchema),
  motivoRecuseController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_RECUSE_EDITAR),
  validate(updateMotivoRecuseSchema),
  motivoRecuseController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MOTIVO_RECUSE_ELIMINAR),
  validate(getMotivoRecuseSchema),
  motivoRecuseController.remove,
);

export default router;
