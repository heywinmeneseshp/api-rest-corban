import { Router } from 'express';
import { fincaController } from '../../controllers/agricola/finca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listFincasSchema,
  getFincaSchema,
  createFincaSchema,
  updateFincaSchema,
  listFincaLotesSchema,
} from '../../validators/agricola/finca.validator.js';

const router = Router();

/**
 * @openapi
 * /fincas:
 *   get:
 *     tags: [Fincas]
 *     summary: Listar fincas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Fincas]
 *     summary: Crear finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.FINCA_VER), validate(listFincasSchema), fincaController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  validate(createFincaSchema),
  fincaController.create,
);

/**
 * @openapi
 * /fincas/{uuid}:
 *   get:
 *     tags: [Fincas]
 *     summary: Obtener finca por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Fincas]
 *     summary: Actualizar finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Fincas]
 *     summary: Eliminar finca (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_VER),
  validate(getFincaSchema),
  fincaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_EDITAR),
  validate(updateFincaSchema),
  fincaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_ELIMINAR),
  validate(getFincaSchema),
  fincaController.remove,
);

/**
 * @openapi
 * /fincas/{uuid}/lotes:
 *   get:
 *     tags: [Fincas]
 *     summary: Listar lotes de una finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/lotes',
  auth,
  permission(PERMISSIONS.LOTE_VER),
  validate(listFincaLotesSchema),
  fincaController.listLotes,
);

/**
 * @openapi
 * /fincas/sync-banarica:
 *   post:
 *     tags: [Fincas]
 *     summary: Sincroniza los almacenes activos de api-rest-banarica como fincas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/sync-banarica',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  fincaController.syncBanarica,
);

export default router;
