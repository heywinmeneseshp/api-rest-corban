import { Router } from 'express';
import { roleController } from '../../controllers/seguridad/role.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listRolesSchema,
  getRoleSchema,
  createRoleSchema,
  updateRoleSchema,
  assignPermisoSchema,
  removePermisoSchema,
} from '../../validators/seguridad/role.validator.js';

const router = Router();

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: Listar roles
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Roles]
 *     summary: Crear rol
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.ROLES_VER), validate(listRolesSchema), roleController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.ROLES_CREAR),
  validate(createRoleSchema),
  roleController.create,
);

/**
 * @openapi
 * /roles/{uuid}:
 *   get:
 *     tags: [Roles]
 *     summary: Obtener rol por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Roles]
 *     summary: Actualizar rol
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Roles]
 *     summary: Eliminar rol (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ROLES_VER),
  validate(getRoleSchema),
  roleController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ROLES_EDITAR),
  validate(updateRoleSchema),
  roleController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ROLES_ELIMINAR),
  validate(getRoleSchema),
  roleController.remove,
);

/**
 * @openapi
 * /roles/{uuid}/permisos:
 *   get:
 *     tags: [Roles]
 *     summary: Listar permisos del rol
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Roles]
 *     summary: Asignar permiso al rol
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/permisos',
  auth,
  permission(PERMISSIONS.ROLES_VER),
  validate(getRoleSchema),
  roleController.listPermisos,
);
router.post(
  '/:uuid/permisos',
  auth,
  permission(PERMISSIONS.ROLES_ASIGNAR_PERMISO),
  validate(assignPermisoSchema),
  roleController.assignPermiso,
);

/**
 * @openapi
 * /roles/{uuid}/permisos/{permisoUuid}:
 *   delete:
 *     tags: [Roles]
 *     summary: Remover permiso del rol
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid/permisos/:permisoUuid',
  auth,
  permission(PERMISSIONS.ROLES_ASIGNAR_PERMISO),
  validate(removePermisoSchema),
  roleController.removePermiso,
);

export default router;
