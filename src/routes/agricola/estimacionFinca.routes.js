import { Router } from 'express';
import { estimacionFincaController } from '../../controllers/agricola/estimacionFinca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listarEstimacionesSchema,
  guardarEstimacionesSchema,
  obtenerSemanasSchema,
  eliminarEstimacionSchema,
  obtenerEscaleraSchema,
  obtenerComparativoSchema,
  exportarComparativoSchema,
  obtenerResumenFincaSchema,
  liquidarSemanaSchema,
  quitarLiquidacionSemanaSchema,
  guardarPatronCortePctSchema,
  guardarRatioCajasPorSemanaSchema,
} from '../../validators/agricola/estimacionFinca.validator.js';

const router = Router();

/**
 * @openapi
 * /estimaciones/semanas:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Próximas semanas a estimar + fincas habilitadas + tasa de conversión
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/semanas',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(obtenerSemanasSchema),
  estimacionFincaController.getSemanas,
);

router.get(
  '/escalera',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(obtenerEscaleraSchema),
  estimacionFincaController.escalera,
);

/**
 * @openapi
 * /estimaciones/comparativo:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Compara lo estimado contra lo realmente producido (Producción Semanal), por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/comparativo',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(obtenerComparativoSchema),
  estimacionFincaController.comparativo,
);

/**
 * @openapi
 * /estimaciones/comparativo/exportar:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Exporta a Excel (.xlsx) el comparativo estimado vs. real, filtrable por año
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo .xlsx }
 */
router.get(
  '/comparativo/exportar',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(exportarComparativoSchema),
  estimacionFincaController.exportarComparativo,
);

/**
 * @openapi
 * /estimaciones/resumen-finca:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Resumen real de racimos de una finca — cintas 13-17 semanas, % de cosecha por edad 8-12 y aprovechamiento (últimas semanas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/resumen-finca',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(obtenerResumenFincaSchema),
  estimacionFincaController.resumenFinca,
);

/**
 * @openapi
 * /estimaciones/liquidar-semana:
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Marca una semana como liquidada para una finca — bloquea crear/editar/eliminar movimientos de racimos de esa semana (salvo Administrador)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/liquidar-semana',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_CREAR),
  validate(liquidarSemanaSchema),
  estimacionFincaController.liquidarSemana,
);

/**
 * @openapi
 * /estimaciones/liquidar-semana:
 *   delete:
 *     tags: [Estimaciones de Fincas]
 *     summary: Deshace la liquidación de una semana para una finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/liquidar-semana',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_CREAR),
  validate(quitarLiquidacionSemanaSchema),
  estimacionFincaController.quitarLiquidacionSemana,
);

/**
 * @openapi
 * /estimaciones/patron-corte-pct:
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Guarda los % editados a mano (por edad 8-12) del estimado de corte, por finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/patron-corte-pct',
  auth,
  permission(PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(guardarPatronCortePctSchema),
  estimacionFincaController.guardarPatronCortePct,
);

/**
 * @openapi
 * /estimaciones/ratio-cajas:
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Guarda los ratios (cajas por racimo) editados a mano por numeroSemana, por finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/ratio-cajas',
  auth,
  permission(PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(guardarRatioCajasPorSemanaSchema),
  estimacionFincaController.guardarRatioCajasPorSemana,
);

router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  uploadBulkFile,
  estimacionFincaController.bulkUpload,
);

router.post(
  '/bulk-update',
  auth,
  permission(PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  uploadBulkFile,
  estimacionFincaController.bulkUpdate,
);

/**
 * @openapi
 * /estimaciones:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Listar estimaciones de cajas por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Guardar (crear/editar) estimaciones de cajas por finca y semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(listarEstimacionesSchema),
  estimacionFincaController.list,
);

router.post(
  '/',
  auth,
  // La grilla básica de "Cargar estimaciones" (cajas por semana) está
  // disponible para los 3 niveles, incluido el nivel base "ver" — ver
  // estimaciones/page.js `puedeUsarGrillaBasica`.
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(guardarEstimacionesSchema),
  estimacionFincaController.save,
);

/**
 * @openapi
 * /estimaciones/{uuid}:
 *   delete:
 *     tags: [Estimaciones de Fincas]
 *     summary: Eliminar una estimación (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(eliminarEstimacionSchema),
  estimacionFincaController.remove,
);

export default router;
