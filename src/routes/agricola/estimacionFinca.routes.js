import { Router } from 'express';
import { estimacionFincaController } from '../../controllers/agricola/estimacionFinca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { requireReportApiKey } from '../../middlewares/requireReportApiKey.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listarEstimacionesSchema,
  guardarEstimacionesSchema,
  obtenerSemanasSchema,
  eliminarEstimacionSchema,
  obtenerEscaleraSchema,
  obtenerPivoteSchema,
  exportarPivoteSchema,
  exportarPivoteCsvSchema,
  obtenerComparativoSchema,
  exportarComparativoSchema,
  obtenerResumenFincaSchema,
  liquidarSemanaSchema,
  quitarLiquidacionSemanaSchema,
  liquidarSemanasMasivoSchema,
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
 * /estimaciones/pivote:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Vista pivote por finca — una fila por finca con lo registrado en la semana vigente para las próximas N semanas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/pivote',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(obtenerPivoteSchema),
  estimacionFincaController.pivote,
);

/**
 * @openapi
 * /estimaciones/pivote/exportar:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Exporta a Excel (.xlsx) la vista pivote por finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo .xlsx }
 */
router.get(
  '/pivote/exportar',
  auth,
  permission(PERMISSIONS.ESTIMACION_VER, PERMISSIONS.ESTIMACION_CREAR, PERMISSIONS.ESTIMACION_EDITAR_DISTRIBUCION),
  validate(exportarPivoteSchema),
  estimacionFincaController.exportarPivote,
);

/**
 * @openapi
 * /estimaciones/pivote/csv:
 *   get:
 *     tags: [Estimaciones de Fincas]
 *     summary: Vista pivote por finca en CSV, para Excel Power Query — sin login, protegido por `apiKey` en la query
 *     description: |
 *       Una fila por cada combinación finca + semana de registro, con sus propias 8 (o `semanas`)
 *       semanas siguientes en columnas "Est 1".."Est N". Pensado para que Excel (Datos → Obtener datos
 *       → Desde la Web) refresque siempre la misma URL, sin login.
 *
 *       Ejemplos:
 *       - Solo la semana vigente, todas las fincas:
 *         `/estimaciones/pivote/csv?apiKey=XXXX`
 *       - Una finca, todo el año 2026:
 *         `/estimaciones/pivote/csv?apiKey=XXXX&finca=503&anio=2026`
 *       - Una finca, rango de semanas de registro por código:
 *         `/estimaciones/pivote/csv?apiKey=XXXX&finca=503&semanaDesde=S37-2026&semanaHasta=S38-2026`
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         required: true
 *         schema: { type: string }
 *         description: Clave de reporte (REPORTES_API_KEY del servidor) — trátala como una contraseña.
 *       - in: query
 *         name: finca
 *         schema: { type: string, example: "503" }
 *         description: Código de la finca. Sin este filtro trae todas las fincas.
 *       - in: query
 *         name: semanaDesde
 *         schema: { type: string, example: "S37-2026" }
 *         description: Semana de registro desde (código Sww-yyyy). Se combina con semanaHasta para un rango.
 *       - in: query
 *         name: semanaHasta
 *         schema: { type: string, example: "S38-2026" }
 *         description: Semana de registro hasta (código Sww-yyyy).
 *       - in: query
 *         name: anio
 *         schema: { type: integer, example: 2026 }
 *         description: Alternativa a semanaDesde/semanaHasta — todas las semanas de registro de ese año. Se ignora si ya diste semanaDesde o semanaHasta.
 *       - in: query
 *         name: semanas
 *         schema: { type: integer, default: 8, minimum: 1, maximum: 53 }
 *         description: Cuántas columnas "Est N" (semanas hacia adelante) mostrar por fila.
 *     responses:
 *       200:
 *         description: Archivo CSV (text/csv)
 *       401:
 *         description: apiKey inválida o no configurada
 */
router.get(
  '/pivote/csv',
  // Sin `auth`/`permission` a propósito — este endpoint es para
  // herramientas externas (Excel) que no manejan login/JWT, se protege con
  // requireReportApiKey en su lugar (clave en la query, no un header).
  requireReportApiKey,
  validate(exportarPivoteCsvSchema),
  estimacionFincaController.exportarPivoteCsv,
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
 * /estimaciones/liquidar-semana-masivo:
 *   post:
 *     tags: [Estimaciones de Fincas]
 *     summary: Liquida todas las semanas de un rango para todas las fincas operativas — Administrador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/liquidar-semana-masivo',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_CREAR),
  validate(liquidarSemanasMasivoSchema),
  estimacionFincaController.liquidarSemanasMasivo,
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
