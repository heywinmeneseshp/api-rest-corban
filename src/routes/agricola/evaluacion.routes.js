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
  promedioPorSemanaSchema,
  indicadoresSchema,
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
 * /evaluaciones/suma-bruta-promedio:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Promedio de suma bruta por semana (todas las fincas o una en particular)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/suma-bruta-promedio',
  auth,
  permission(PERMISSIONS.SUMA_BRUTA_VER),
  validate(promedioPorSemanaSchema),
  evaluacionController.promedioSumaBruta,
);

/**
 * @openapi
 * /evaluaciones/conteo-promedio:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Promedio de hojas funcionales (conteo de hojas) por semana (todas las fincas o una en particular)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/conteo-promedio',
  auth,
  permission(PERMISSIONS.CONTEO_HOJAS_VER),
  validate(promedioPorSemanaSchema),
  evaluacionController.promedioConteo,
);

/**
 * @openapi
 * /evaluaciones/infeccion-promedio:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Promedio de YLI, YLS y hojas totales por semana (todas las fincas o una en particular)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/infeccion-promedio',
  auth,
  permission(PERMISSIONS.INFECCION_VER),
  validate(promedioPorSemanaSchema),
  evaluacionController.promedioInfeccion,
);

/**
 * @openapi
 * /evaluaciones/indicadores:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Indicadores de evaluaciones por semana (conteo por tipo, usuario y finca + promedios)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/indicadores',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(indicadoresSchema),
  evaluacionController.indicadores,
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
