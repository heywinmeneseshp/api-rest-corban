import { Router } from 'express';
import { configuracionController } from '../../controllers/sistema/configuracion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { updateBanaricaUrlSchema } from '../../validators/sistema/configuracion.validator.js';

const router = Router();

/**
 * @openapi
 * /configuraciones/banarica-url:
 *   get:
 *     tags: [Configuraciones]
 *     summary: Obtener el enlace configurado del API de banarica
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Configuraciones]
 *     summary: Guardar el enlace del API de banarica
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/banarica-url', auth, configuracionController.getBanaricaUrl);
router.put(
  '/banarica-url',
  auth,
  validate(updateBanaricaUrlSchema),
  configuracionController.updateBanaricaUrl,
);

export default router;
