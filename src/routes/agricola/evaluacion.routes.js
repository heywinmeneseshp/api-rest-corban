import { Router } from 'express';
import { evaluacionController } from '../../controllers/agricola/evaluacion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listEvaluacionesSchema,
  getEvaluacionSchema,
  createEvaluacionSchema,
  updateEvaluacionSchema,
} from '../../validators/agricola/evaluacion.validator.js';

const router = Router();

/**
 * @openapi
 * /evaluaciones:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Listar evaluaciones
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Evaluaciones]
 *     summary: Crear evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(listEvaluacionesSchema),
  evaluacionController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.EVALUACION_CREAR),
  validate(createEvaluacionSchema),
  evaluacionController.create,
);

/**
 * @openapi
 * /evaluaciones/{uuid}:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Obtener evaluación por UUID (incluye infección, conteo de hojas y suma bruta si existen)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Evaluaciones]
 *     summary: Actualizar evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Evaluaciones]
 *     summary: Anular evaluación (estado = false)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(getEvaluacionSchema),
  evaluacionController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.EVALUACION_EDITAR),
  validate(updateEvaluacionSchema),
  evaluacionController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.EVALUACION_ELIMINAR),
  validate(getEvaluacionSchema),
  evaluacionController.remove,
);

export default router;
