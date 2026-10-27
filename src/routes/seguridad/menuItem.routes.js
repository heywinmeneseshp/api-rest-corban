import { Router } from 'express';
import { menuItemController } from '../../controllers/seguridad/menuItem.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  getMenuItemSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '../../validators/seguridad/menuItem.validator.js';

const router = Router();

/**
 * @openapi
 * /menu:
 *   get:
 *     tags: [Menú]
 *     summary: Obtener árbol de menú filtrado por permisos del usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Menú]
 *     summary: Crear ítem de menú
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, menuItemController.getTree);
router.post(
  '/',
  auth,
  requireAdmin,
  validate(createMenuItemSchema),
  menuItemController.create,
);

/**
 * @openapi
 * /menu/{uuid}:
 *   get:
 *     tags: [Menú]
 *     summary: Obtener ítem de menú por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Menú]
 *     summary: Actualizar ítem de menú
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Menú]
 *     summary: Eliminar ítem de menú (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  requireAdmin,
  validate(getMenuItemSchema),
  menuItemController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  requireAdmin,
  validate(updateMenuItemSchema),
  menuItemController.update,
);
router.delete(
  '/:uuid',
  auth,
  requireAdmin,
  validate(getMenuItemSchema),
  menuItemController.remove,
);

export default router;
