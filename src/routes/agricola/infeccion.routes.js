import { Router } from 'express';
import { infeccionController } from '../../controllers/agricola/infeccion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  getInfeccionSchema,
  createInfeccionSchema,
  updateInfeccionSchema,
} from '../../validators/agricola/infeccion.validator.js';

const router = Router();

/**
 * @openapi
 * /evaluaciones/{uuid}/infeccion:
 *   get:
 *     tags: [Infecciones]
 *     summary: Obtener la infección registrada para una evaluación (con detalle de hojas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *       404: { description: No registrada }
 *   post:
 *     tags: [Infecciones]
 *     summary: Registrar infección + hojas infectadas para una evaluación (transaccional)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 *       409: { description: Ya existe una infección para esta evaluación }
 *   put:
 *     tags: [Infecciones]
 *     summary: Actualizar infección de una evaluación (reemplaza hojas si se envían)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/infeccion',
  auth,
  permission(PERMISSIONS.INFECCION_VER),
  validate(getInfeccionSchema),
  infeccionController.getByEvaluacion,
);
router.post(
  '/:uuid/infeccion',
  auth,
  permission(PERMISSIONS.INFECCION_CREAR),
  validate(createInfeccionSchema),
  infeccionController.create,
);
router.put(
  '/:uuid/infeccion',
  auth,
  permission(PERMISSIONS.INFECCION_EDITAR),
  validate(updateInfeccionSchema),
  infeccionController.update,
);

export default router;
