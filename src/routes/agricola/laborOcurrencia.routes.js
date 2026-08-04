import { Router } from 'express';
import { laborOcurrenciaController } from '../../controllers/agricola/laborOcurrencia.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listLaborOcurrenciasSchema,
  getLaborOcurrenciaSchema,
  updateLaborOcurrenciaSchema,
  deleteLaborOcurrenciaSchema,
} from '../../validators/agricola/laborOcurrencia.validator.js';

const router = Router();

/**
 * @openapi
 * /labor-ocurrencias:
 *   get:
 *     tags: [Calendario de Labores]
 *     summary: Listar ocurrencias de una finca en un año (vista anual por semanas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_VER),
  validate(listLaborOcurrenciasSchema),
  laborOcurrenciaController.list,
);

/**
 * @openapi
 * /labor-ocurrencias/{uuid}:
 *   get:
 *     tags: [Calendario de Labores]
 *     summary: Obtener una ocurrencia por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Calendario de Labores]
 *     summary: Editar una ocurrencia. `alcance` en el body (ESTA/ESTA_Y_SIGUIENTES/TODA_LA_SERIE) define el efecto sobre la serie.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Calendario de Labores]
 *     summary: Eliminar una ocurrencia. `alcance` en el query (ESTA/ESTA_Y_SIGUIENTES/TODA_LA_SERIE) define el efecto sobre la serie.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_VER),
  validate(getLaborOcurrenciaSchema),
  laborOcurrenciaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_EDITAR),
  validate(updateLaborOcurrenciaSchema),
  laborOcurrenciaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.LABOR_PROGRAMACION_ELIMINAR),
  validate(deleteLaborOcurrenciaSchema),
  laborOcurrenciaController.remove,
);

export default router;
