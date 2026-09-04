import { Router } from 'express';
import { evaluacionController } from '../../controllers/agricola/evaluacion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listEvaluacionesSchema,
  getEvaluacionSchema,
  createEvaluacionSchema,
  updateEvaluacionSchema,
  promedioPorSemanaSchema,
  indicadoresSchema,
  listObjetivosSchema,
  getObjetivoSchema,
  createObjetivoSchema,
  updateObjetivoSchema,
  progresoObjetivosSchema,
  setSbHojaUmbralesSchema,
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
  permission(PERMISSIONS.EVALUACION_VER),
  validate(promedioPorSemanaSchema),
  evaluacionController.promedioSumaBruta,
);

/**
 * @openapi
 * /evaluaciones/suma-bruta-promedio-por-hoja:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Promedio de Suma Bruta desglosado por hoja (3, 4 o 5) y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/suma-bruta-promedio-por-hoja',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(promedioPorSemanaSchema),
  evaluacionController.promedioSumaBrutaPorHoja,
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
  permission(PERMISSIONS.EVALUACION_VER),
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
  permission(PERMISSIONS.EVALUACION_VER),
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
 * /evaluaciones/alertas-semana:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Alertas por finca de la última semana cerrada (YLI bajo, Índice de Infección alto)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/alertas-semana',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  evaluacionController.alertasSemana,
);

/**
 * @openapi
 * /evaluaciones/alertas-semana/enviar:
 *   post:
 *     tags: [Evaluaciones]
 *     summary: Envía por correo el resumen de alertas de la última semana cerrada (o la indicada) a los destinatarios configurados — Administrador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/alertas-semana/enviar',
  auth,
  requireAdmin,
  evaluacionController.enviarAlertasManual,
);

/**
 * @openapi
 * /evaluaciones/alertas-destinatarios:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Obtiene la config de destinatarios del correo de alertas de Sanidad Vegetal — Administrador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Evaluaciones]
 *     summary: Guarda la config de destinatarios del correo de alertas de Sanidad Vegetal — Administrador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/alertas-destinatarios',
  auth,
  requireAdmin,
  evaluacionController.getAlertasDestinatarios,
);
router.put(
  '/alertas-destinatarios',
  auth,
  requireAdmin,
  evaluacionController.setAlertasDestinatarios,
);

/**
 * @openapi
 * /evaluaciones/sb-hoja-umbrales:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Obtiene los umbrales (líneas de referencia) del gráfico de Suma Bruta por Hoja
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Evaluaciones]
 *     summary: Guarda los umbrales del gráfico de Suma Bruta por Hoja — Administrador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/sb-hoja-umbrales',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  evaluacionController.getSbHojaUmbrales,
);
router.put(
  '/sb-hoja-umbrales',
  auth,
  requireAdmin,
  validate(setSbHojaUmbralesSchema),
  evaluacionController.setSbHojaUmbrales,
);

/**
 * @openapi
 * /evaluaciones/objetivos/progreso:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Progreso de los objetivos aplicables a una finca y/o lote en la semana actual (o la indicada)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/objetivos/progreso',
  auth,
  validate(progresoObjetivosSchema),
  evaluacionController.progresoObjetivos,
);

/**
 * @openapi
 * /evaluaciones/objetivos:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Listar objetivos de evaluación (meta semanal por finca o lote)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Evaluaciones]
 *     summary: Crear objetivo de evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/objetivos',
  auth,
  permission(PERMISSIONS.OBJETIVO_EVALUACION_VER),
  validate(listObjetivosSchema),
  evaluacionController.listObjetivos,
);
router.post(
  '/objetivos',
  auth,
  permission(PERMISSIONS.OBJETIVO_EVALUACION_CREAR),
  validate(createObjetivoSchema),
  evaluacionController.createObjetivo,
);

/**
 * @openapi
 * /evaluaciones/objetivos/{uuid}:
 *   get:
 *     tags: [Evaluaciones]
 *     summary: Obtener objetivo de evaluación por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Evaluaciones]
 *     summary: Actualizar objetivo de evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Evaluaciones]
 *     summary: Eliminar objetivo de evaluación (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/objetivos/:uuid',
  auth,
  permission(PERMISSIONS.OBJETIVO_EVALUACION_VER),
  validate(getObjetivoSchema),
  evaluacionController.getObjetivoByUuid,
);
router.put(
  '/objetivos/:uuid',
  auth,
  permission(PERMISSIONS.OBJETIVO_EVALUACION_EDITAR),
  validate(updateObjetivoSchema),
  evaluacionController.updateObjetivo,
);
router.delete(
  '/objetivos/:uuid',
  auth,
  permission(PERMISSIONS.OBJETIVO_EVALUACION_ELIMINAR),
  validate(getObjetivoSchema),
  evaluacionController.removeObjetivo,
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
