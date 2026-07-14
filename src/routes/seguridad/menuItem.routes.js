import { Router } from 'express';
import { menuItemController } from '../../controllers/seguridad/menuItem.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
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
  permission(PERMISSIONS.MENU_CREAR),
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
  permission(PERMISSIONS.MENU_VER),
  validate(getMenuItemSchema),
  menuItemController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MENU_EDITAR),
  validate(updateMenuItemSchema),
  menuItemController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MENU_ELIMINAR),
  validate(getMenuItemSchema),
  menuItemController.remove,
);

export default router;
