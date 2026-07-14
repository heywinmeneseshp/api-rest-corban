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
router.get('/', auth, permission(PERMISSIONS.USUARIOS_VER), validate(listUsersSchema), userController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.USUARIOS_CREAR),
  validate(createUserSchema),
  userController.create,
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
  permission(PERMISSIONS.USUARIOS_VER),
  validate(getUserSchema),
  userController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.USUARIOS_EDITAR),
  validate(updateUserSchema),
  userController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.USUARIOS_ELIMINAR),
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
  permission(PERMISSIONS.USUARIOS_VER),
  validate(getUserSchema),
  userController.listRoles,
);
router.post(
  '/:uuid/roles',
  auth,
  permission(PERMISSIONS.USUARIOS_ASIGNAR_ROL),
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
  permission(PERMISSIONS.USUARIOS_ASIGNAR_ROL),
  validate(removeRoleSchema),
  userController.removeRole,
);

export default router;
