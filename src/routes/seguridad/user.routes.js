import { Router } from 'express';
import { userController } from '../../controllers/seguridad/user.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listUsersSchema,
  getUserSchema,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  removeRoleSchema,
  assignFincaSchema,
  removeFincaSchema,
  bulkResetPasswordSchema,
} from '../../validators/seguridad/user.validator.js';

const router = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar usuarios
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Usuarios]
 *     summary: Crear usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.MENU_MAESTROS_USUARIOS), validate(listUsersSchema), userController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(createUserSchema),
  userController.create,
);

/**
 * @openapi
 * /users/bulk-reset-password:
 *   post:
 *     tags: [Usuarios]
 *     summary: Restablecer contraseñas de múltiples usuarios
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-reset-password',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(bulkResetPasswordSchema),
  userController.bulkResetPassword,
);

/**
 * @openapi
 * /users/{uuid}:
 *   get:
 *     tags: [Usuarios]
 *     summary: Obtener usuario por UUID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Usuarios]
 *     summary: Actualizar usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Usuarios]
 *     summary: Eliminar usuario (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(getUserSchema),
  userController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(updateUserSchema),
  userController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(getUserSchema),
  userController.remove,
);

/**
 * @openapi
 * /users/{uuid}/roles:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar roles del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Usuarios]
 *     summary: Asignar rol al usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/roles',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(getUserSchema),
  userController.listRoles,
);
router.post(
  '/:uuid/roles',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(assignRoleSchema),
  userController.assignRole,
);

/**
 * @openapi
 * /users/{uuid}/roles/{roleUuid}:
 *   delete:
 *     tags: [Usuarios]
 *     summary: Remover rol del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid/roles/:roleUuid',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(removeRoleSchema),
  userController.removeRole,
);

/**
 * @openapi
 * /users/{uuid}/fincas:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar fincas asignadas al usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Usuarios]
 *     summary: Asignar finca al usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/fincas',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(getUserSchema),
  userController.listFincas,
);
router.post(
  '/:uuid/fincas',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(assignFincaSchema),
  userController.assignFinca,
);

/**
 * @openapi
 * /users/{uuid}/fincas/{fincaUuid}:
 *   delete:
 *     tags: [Usuarios]
 *     summary: Remover finca del usuario
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid/fincas/:fincaUuid',
  auth,
  permission(PERMISSIONS.MENU_MAESTROS_USUARIOS),
  validate(removeFincaSchema),
  userController.removeFinca,
);

export default router;
