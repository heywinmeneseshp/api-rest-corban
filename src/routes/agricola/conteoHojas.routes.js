import { Router } from 'express';
import { conteoHojasController } from '../../controllers/agricola/conteoHojas.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  getConteoSchema,
  createConteoSchema,
  updateConteoSchema,
} from '../../validators/agricola/conteoHojas.validator.js';

const router = Router();

/**
 * @openapi
 * /evaluaciones/{uuid}/conteo-hojas:
 *   get:
 *     tags: [Conteo de Hojas]
 *     summary: Obtener el conteo de hojas de una evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *       404: { description: No registrado }
 *   post:
 *     tags: [Conteo de Hojas]
 *     summary: Registrar conteo de hojas para una evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 *   put:
 *     tags: [Conteo de Hojas]
 *     summary: Actualizar conteo de hojas de una evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/conteo-hojas',
  auth,
  permission(PERMISSIONS.CONTEO_HOJAS_VER),
  validate(getConteoSchema),
  conteoHojasController.getByEvaluacion,
);
router.post(
  '/:uuid/conteo-hojas',
  auth,
  permission(PERMISSIONS.CONTEO_HOJAS_CREAR),
  validate(createConteoSchema),
  conteoHojasController.create,
);
router.put(
  '/:uuid/conteo-hojas',
  auth,
  permission(PERMISSIONS.CONTEO_HOJAS_EDITAR),
  validate(updateConteoSchema),
  conteoHojasController.update,
);

export default router;
