import { Router } from 'express';
import { tipoEvaluacionController } from '../../controllers/agricola/tipoEvaluacion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listTiposSchema,
  getTipoSchema,
  createTipoSchema,
  updateTipoSchema,
} from '../../validators/agricola/tipoEvaluacion.validator.js';

const router = Router();

/**
 * @openapi
 * /tipos-evaluacion:
 *   get:
 *     tags: [Tipos de Evaluación]
 *     summary: Listar tipos de evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Tipos de Evaluación]
 *     summary: Crear tipo de evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.TIPO_EVALUACION_VER),
  validate(listTiposSchema),
  tipoEvaluacionController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.TIPO_EVALUACION_CREAR),
  validate(createTipoSchema),
  tipoEvaluacionController.create,
);

/**
 * @openapi
 * /tipos-evaluacion/{uuid}:
 *   get:
 *     tags: [Tipos de Evaluación]
 *     summary: Obtener tipo de evaluación por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Tipos de Evaluación]
 *     summary: Actualizar tipo de evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Tipos de Evaluación]
 *     summary: Eliminar tipo de evaluación (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.TIPO_EVALUACION_VER),
  validate(getTipoSchema),
  tipoEvaluacionController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.TIPO_EVALUACION_EDITAR),
  validate(updateTipoSchema),
  tipoEvaluacionController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.TIPO_EVALUACION_ELIMINAR),
  validate(getTipoSchema),
  tipoEvaluacionController.remove,
);

export default router;
