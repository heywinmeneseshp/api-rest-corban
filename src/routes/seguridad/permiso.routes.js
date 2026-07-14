import { Router } from 'express';
import { permisoController } from '../../controllers/seguridad/permiso.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listPermisosSchema,
  getPermisoSchema,
  createPermisoSchema,
  updatePermisoSchema,
} from '../../validators/seguridad/permiso.validator.js';

const router = Router();

/**
 * @openapi
 * /permisos:
 *   get:
 *     tags: [Permisos]
 *     summary: Listar permisos
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Permisos]
 *     summary: Crear permiso
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.PERMISOS_VER),
  validate(listPermisosSchema),
  permisoController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.PERMISOS_CREAR),
  validate(createPermisoSchema),
  permisoController.create,
);

/**
 * @openapi
 * /permisos/{uuid}:
 *   get:
 *     tags: [Permisos]
 *     summary: Obtener permiso por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Permisos]
 *     summary: Actualizar permiso
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Permisos]
 *     summary: Eliminar permiso (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PERMISOS_VER),
  validate(getPermisoSchema),
  permisoController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PERMISOS_EDITAR),
  validate(updatePermisoSchema),
  permisoController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PERMISOS_ELIMINAR),
  validate(getPermisoSchema),
  permisoController.remove,
);

export default router;
