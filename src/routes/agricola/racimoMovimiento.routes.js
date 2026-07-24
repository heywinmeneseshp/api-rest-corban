import { Router } from 'express';
import { racimoMovimientoController } from '../../controllers/agricola/racimoMovimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listRacimoMovimientosSchema,
  getRacimoMovimientoSchema,
  createRacimoMovimientoSchema,
  inventarioRacimosSchema,
  resumenCohorteSchema,
  reporteSaldosSchema,
  reporteEmbolsesSchema,
  exportarMovimientosSchema,
  exportarReporteSemanalSchema,
} from '../../validators/agricola/racimoMovimiento.validator.js';

const router = Router();

/**
 * @openapi
 * /racimo-movimientos/bulk-progress/{token}:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Progreso en tiempo real del cargue masivo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/bulk-progress/:token', auth, racimoMovimientoController.bulkProgress);

/**
 * @openapi
 * /racimo-movimientos/inventario:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Inventario de racimos embolsados por cohorte (finca + lote + semana de embolse)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/inventario',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(inventarioRacimosSchema),
  racimoMovimientoController.inventario,
);

/**
 * @openapi
 * /racimo-movimientos/resumen-cohorte:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Resumen (embolsado/repicado/recusado/procesado/saldo) de una cohorte puntual
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/resumen-cohorte',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(resumenCohorteSchema),
  racimoMovimientoController.resumenCohorte,
);

/**
 * @openapi
 * /racimo-movimientos:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Listar movimientos de racimos
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Movimientos de Racimos]
 *     summary: Registrar movimiento de racimos (embolse, repique, recuse o corte)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(listRacimoMovimientosSchema),
  racimoMovimientoController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_CREAR),
  validate(createRacimoMovimientoSchema),
  racimoMovimientoController.create,
);

/**
 * @openapi
 * /racimo-movimientos/reporte-saldos:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Reporte de saldos por lotes y cintas (tabla dinámica)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/reporte-saldos',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(reporteSaldosSchema),
  racimoMovimientoController.reporteSaldos,
);

/**
 * @openapi
 * /racimo-movimientos/reporte-embolses:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Total de embolses por semana en un año (general o por finca), para gráfico de líneas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/reporte-embolses',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(reporteEmbolsesSchema),
  racimoMovimientoController.reporteEmbolses,
);

/**
 * @openapi
 * /racimo-movimientos/bulk-upload:
 *   post:
 *     tags: [Movimientos de Racimos]
 *     summary: Cargue masivo de movimientos históricos desde un archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_CREAR),
  uploadBulkFile,
  racimoMovimientoController.bulkUpload,
);

/**
 * @openapi
 * /racimo-movimientos/exportar:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Exportar movimientos a Excel con los filtros actuales
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo Excel }
 */
router.get(
  '/exportar',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(exportarMovimientosSchema),
  racimoMovimientoController.exportar,
);

/**
 * @openapi
 * /racimo-movimientos/exportar-semanal:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Descarga semanal en el formato exacto (Semana/Año/Finca/Lote/Edad/Novedad/Cantidad) para cargar en el sistema externo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo Excel }
 */
router.get(
  '/exportar-semanal',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(exportarReporteSemanalSchema),
  racimoMovimientoController.exportarReporteSemanal,
);

/**
 * @openapi
 * /racimo-movimientos/{uuid}:
 *   get:
 *     tags: [Movimientos de Racimos]
 *     summary: Obtener movimiento de racimos por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Movimientos de Racimos]
 *     summary: Eliminar movimiento de racimos (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_VER),
  validate(getRacimoMovimientoSchema),
  racimoMovimientoController.getByUuid,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.RACIMO_MOVIMIENTO_ELIMINAR),
  validate(getRacimoMovimientoSchema),
  racimoMovimientoController.remove,
);

export default router;
