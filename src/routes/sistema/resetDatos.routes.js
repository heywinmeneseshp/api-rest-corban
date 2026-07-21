import { Router } from 'express';
import { resetDatosController } from '../../controllers/sistema/resetDatos.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { resetDatosSchema } from '../../validators/sistema/resetDatos.validator.js';

const router = Router();

/**
 * @openapi
 * /sistema/reset-datos:
 *   post:
 *     tags: [Sistema]
 *     summary: Borra todos los datos posteriores a la instalación (todo lo que no viene de los seeders). Requiere confirmación exacta y permiso de Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/reset-datos',
  auth,
  permission(PERMISSIONS.SISTEMA_RESET_DATOS),
  validate(resetDatosSchema),
  resetDatosController.resetDatosNoSeed,
);

export default router;
