import { Router } from 'express';
import { configuracionController } from '../../controllers/sistema/configuracion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  updateBanaricaUrlSchema,
  updateAppVersionInfoSchema,
} from '../../validators/sistema/configuracion.validator.js';

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

/**
 * @openapi
 * /configuraciones/app-version:
 *   get:
 *     tags: [Configuraciones]
 *     summary: Obtener la versión mínima/última soportada de la app móvil
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Configuraciones]
 *     summary: Configurar la versión mínima/última soportada de la app móvil
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Sin `auth`: la app móvil debe poder chequear la versión incluso antes de
// iniciar sesión (por ejemplo, en la pantalla de splash/login).
router.get('/app-version', configuracionController.getAppVersionInfo);
router.put(
  '/app-version',
  auth,
  validate(updateAppVersionInfoSchema),
  configuracionController.updateAppVersionInfo,
);

export default router;
