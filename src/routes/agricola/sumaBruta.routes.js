import { Router } from 'express';
import { sumaBrutaController } from '../../controllers/agricola/sumaBruta.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  getSumaBrutaSchema,
  createSumaBrutaSchema,
  updateSumaBrutaSchema,
} from '../../validators/agricola/sumaBruta.validator.js';

const router = Router();

/**
 * @openapi
 * /evaluaciones/{uuid}/suma-bruta:
 *   get:
 *     tags: [Suma Bruta]
 *     summary: Obtener la suma bruta de una evaluación (con estadios por hoja)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *       404: { description: No registrada }
 *   post:
 *     tags: [Suma Bruta]
 *     summary: Registrar suma bruta + estadios por hoja (transaccional)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 *   put:
 *     tags: [Suma Bruta]
 *     summary: Actualizar suma bruta de una evaluación (reemplaza estadios si se envían)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/suma-bruta',
  auth,
  permission(PERMISSIONS.SUMA_BRUTA_VER),
  validate(getSumaBrutaSchema),
  sumaBrutaController.getByEvaluacion,
);
router.post(
  '/:uuid/suma-bruta',
  auth,
  permission(PERMISSIONS.SUMA_BRUTA_CREAR),
  validate(createSumaBrutaSchema),
  sumaBrutaController.create,
);
router.put(
  '/:uuid/suma-bruta',
  auth,
  permission(PERMISSIONS.SUMA_BRUTA_EDITAR),
  validate(updateSumaBrutaSchema),
  sumaBrutaController.update,
);

export default router;
