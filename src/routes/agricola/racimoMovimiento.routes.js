import { Router } from 'express';
import { racimoMovimientoController } from '../../controllers/agricola/racimoMovimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listRacimoMovimientosSchema,
  getRacimoMovimientoSchema,
  createRacimoMovimientoSchema,
  inventarioRacimosSchema,
  resumenCohorteSchema,
} from '../../validators/agricola/racimoMovimiento.validator.js';

const router = Router();

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
