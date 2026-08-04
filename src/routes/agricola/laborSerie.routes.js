import { Router } from 'express';
import { laborSerieController } from '../../controllers/agricola/laborSerie.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { getLaborSerieSchema, createLaborSerieSchema } from '../../validators/agricola/laborSerie.validator.js';

const router = Router();

/**
 * @openapi
 * /labor-series:
 *   post:
 *     tags: [Calendario de Labores]
 *     summary: Crear una programación de labor (puntual o recurrente, con 1 o varios lotes)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.post(
  '/',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_CREAR),
  validate(createLaborSerieSchema),
  laborSerieController.create,
);

/**
 * @openapi
 * /labor-series/{uuid}:
 *   get:
 *     tags: [Calendario de Labores]
 *     summary: Obtener una programación por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Calendario de Labores]
 *     summary: Eliminar la serie completa (soft delete de sus ocurrencias programadas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_VER),
  validate(getLaborSerieSchema),
  laborSerieController.getByUuid,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_ELIMINAR),
  validate(getLaborSerieSchema),
  laborSerieController.remove,
);

export default router;
