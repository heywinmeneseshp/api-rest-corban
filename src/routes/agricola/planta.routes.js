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
  getPlantaByCodeSchema,
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
// Crear planta: sin permiso puntual — cualquier usuario autenticado puede
// registrar plantas, no hace falta granularlo por rol.
router.post(
  '/',
  auth,
  validate(createPlantaSchema),
  plantaController.create,
);

/**
 * @openapi
 * /plantas/by-code:
 *   get:
 *     tags: [Plantas]
 *     summary: Buscar planta por lote y código
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: loteUuid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: codigo
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: No encontrada }
 */
router.get(
  '/by-code',
  auth,
  permission(PERMISSIONS.PLANTA_VER),
  validate(getPlantaByCodeSchema),
  plantaController.getByCode,
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
// Editar/eliminar planta: sin permiso puntual, mismo criterio que crear.
router.put(
  '/:uuid',
  auth,
  validate(updatePlantaSchema),
  plantaController.update,
);
router.delete(
  '/:uuid',
  auth,
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
