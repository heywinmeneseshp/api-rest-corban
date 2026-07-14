import { Router } from 'express';
import { plantaController } from '../../controllers/agricola/planta.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listPlantasSchema,
  getPlantaSchema,
  createPlantaSchema,
  updatePlantaSchema,
  listPlantaEvaluacionesSchema,
} from '../../validators/agricola/planta.validator.js';

const router = Router();

/**
 * @openapi
 * /plantas:
 *   get:
 *     tags: [Plantas]
 *     summary: Listar plantas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Plantas]
 *     summary: Crear planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.PLANTA_VER),
  validate(listPlantasSchema),
  plantaController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.PLANTA_CREAR),
  validate(createPlantaSchema),
  plantaController.create,
);

/**
 * @openapi
 * /plantas/{uuid}:
 *   get:
 *     tags: [Plantas]
 *     summary: Obtener planta por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Plantas]
 *     summary: Actualizar planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Plantas]
 *     summary: Eliminar planta (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PLANTA_VER),
  validate(getPlantaSchema),
  plantaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PLANTA_EDITAR),
  validate(updatePlantaSchema),
  plantaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PLANTA_ELIMINAR),
  validate(getPlantaSchema),
  plantaController.remove,
);

/**
 * @openapi
 * /plantas/{uuid}/evaluaciones:
 *   get:
 *     tags: [Plantas]
 *     summary: Listar evaluaciones de una planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/evaluaciones',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(listPlantaEvaluacionesSchema),
  plantaController.listEvaluaciones,
);

export default router;
