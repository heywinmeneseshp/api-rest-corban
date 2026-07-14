import { Router } from 'express';
import { semanaController } from '../../controllers/agricola/semana.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listSemanasSchema,
  getSemanaSchema,
  createSemanaSchema,
  updateSemanaSchema,
} from '../../validators/agricola/semana.validator.js';

const router = Router();

/**
 * @openapi
 * /semanas:
 *   get:
 *     tags: [Semanas]
 *     summary: Listar semanas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Semanas]
 *     summary: Crear semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.SEMANA_VER),
  validate(listSemanasSchema),
  semanaController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.SEMANA_CREAR),
  validate(createSemanaSchema),
  semanaController.create,
);

/**
 * @openapi
 * /semanas/{uuid}:
 *   get:
 *     tags: [Semanas]
 *     summary: Obtener semana por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Semanas]
 *     summary: Actualizar semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Semanas]
 *     summary: Eliminar semana (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.SEMANA_VER),
  validate(getSemanaSchema),
  semanaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.SEMANA_EDITAR),
  validate(updateSemanaSchema),
  semanaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.SEMANA_ELIMINAR),
  validate(getSemanaSchema),
  semanaController.remove,
);

export default router;
