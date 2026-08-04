import { Router } from 'express';
import { laborController } from '../../controllers/agricola/labor.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listLaboresSchema,
  getLaborSchema,
  createLaborSchema,
  updateLaborSchema,
} from '../../validators/agricola/labor.validator.js';

const router = Router();

/**
 * @openapi
 * /labores:
 *   get:
 *     tags: [Labores]
 *     summary: Listar labores
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Labores]
 *     summary: Crear labor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.LABOR_VER), validate(listLaboresSchema), laborController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.LABOR_CREAR),
  validate(createLaborSchema),
  laborController.create,
);

/**
 * @openapi
 * /labores/{uuid}:
 *   get:
 *     tags: [Labores]
 *     summary: Obtener labor por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Labores]
 *     summary: Actualizar labor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Labores]
 *     summary: Eliminar labor (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_VER),
  validate(getLaborSchema),
  laborController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_EDITAR),
  validate(updateLaborSchema),
  laborController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_ELIMINAR),
  validate(getLaborSchema),
  laborController.remove,
);

export default router;
