import { Router } from 'express';
import { permisoController } from '../../controllers/seguridad/permiso.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
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
// Leer permisos: quien ve o arma roles. Crear/editar/eliminar: solo Administrador (los permisos los define el código).
const PUEDE_LEER = [PERMISSIONS.ROLES_VER, PERMISSIONS.ROLES_ASIGNAR_PERMISO];

router.get(
  '/',
  auth,
  permission(...PUEDE_LEER),
  validate(listPermisosSchema),
  permisoController.list,
);

/**
 * @openapi
 * /permisos/catalogo:
 *   get:
 *     tags: [Permisos]
 *     summary: Catálogo para armar roles (secciones y pantallas del menú con sus permisos)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/catalogo', auth, permission(...PUEDE_LEER), permisoController.catalogo);

router.post(
  '/',
  auth,
  requireAdmin,
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
  permission(...PUEDE_LEER),
  validate(getPermisoSchema),
  permisoController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  requireAdmin,
  validate(updatePermisoSchema),
  permisoController.update,
);
router.delete(
  '/:uuid',
  auth,
  requireAdmin,
  validate(getPermisoSchema),
  permisoController.remove,
);

export default router;
