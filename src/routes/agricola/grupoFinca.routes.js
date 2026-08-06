import { Router } from 'express';
import { grupoFincaController } from '../../controllers/agricola/grupoFinca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listGruposFincaSchema,
  getGrupoFincaSchema,
  createGrupoFincaSchema,
  updateGrupoFincaSchema,
} from '../../validators/agricola/grupoFinca.validator.js';

const router = Router();

/**
 * @openapi
 * /grupos-finca:
 *   get:
 *     tags: [Grupos de Finca]
 *     summary: Listar grupos de finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Grupos de Finca]
 *     summary: Crear grupo de finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.GRUPO_FINCA_VER),
  validate(listGruposFincaSchema),
  grupoFincaController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.GRUPO_FINCA_CREAR),
  validate(createGrupoFincaSchema),
  grupoFincaController.create,
);

/**
 * @openapi
 * /grupos-finca/{uuid}:
 *   get:
 *     tags: [Grupos de Finca]
 *     summary: Obtener grupo de finca por UUID (incluye sus fincas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Grupos de Finca]
 *     summary: Actualizar grupo de finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Grupos de Finca]
 *     summary: Eliminar grupo de finca (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.GRUPO_FINCA_VER),
  validate(getGrupoFincaSchema),
  grupoFincaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.GRUPO_FINCA_EDITAR),
  validate(updateGrupoFincaSchema),
  grupoFincaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.GRUPO_FINCA_ELIMINAR),
  validate(getGrupoFincaSchema),
  grupoFincaController.remove,
);

export default router;
