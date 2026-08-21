import { Router } from 'express';
import { configuracionController } from '../../controllers/sistema/configuracion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { deployKeyOrAuth } from '../../middlewares/deployKeyOrAuth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  updateBanaricaUrlSchema,
  updateLogisticaSchema,
  updateTasaConversionSchema,
  updateAppVersionInfoSchema,
  updateMarcaAppSchema,
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
router.get('/banarica-url', auth, requireAdmin, configuracionController.getBanaricaUrl);
router.put(
  '/banarica-url',
  auth,
  requireAdmin,
  validate(updateBanaricaUrlSchema),
  configuracionController.updateBanaricaUrl,
);

/**
 * @openapi
 * /configuraciones/logistica:
 *   get:
 *     tags: [Configuraciones]
 *     summary: Obtener el enlace y usuario configurados del API de Logística (banarica). Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Configuraciones]
 *     summary: Guardar el enlace, usuario y (opcional) contraseña del API de Logística. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/logistica', auth, requireAdmin, configuracionController.getLogistica);
router.put(
  '/logistica',
  auth,
  requireAdmin,
  validate(updateLogisticaSchema),
  configuracionController.updateLogistica,
);

/**
 * @openapi
 * /configuraciones/tasa-conversion:
 *   get:
 *     tags: [Configuraciones]
 *     summary: Peso neto de referencia (kg) para convertir cajas de Programación de Corte a "cajas de 20kg"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Configuraciones]
 *     summary: Configurar la tasa de conversión. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/tasa-conversion', auth, configuracionController.getTasaConversion);
router.put(
  '/tasa-conversion',
  auth,
  requireAdmin,
  validate(updateTasaConversionSchema),
  configuracionController.updateTasaConversion,
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
 *     description: >
 *       Acepta login normal (panel admin) o el header `X-Deploy-Key` con la
 *       clave dedicada del script de publish-version (sin usuario/contraseña).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Sin `auth`: la app móvil debe poder chequear la versión incluso antes de
// iniciar sesión (por ejemplo, en la pantalla de splash/login).
router.get('/app-version', configuracionController.getAppVersionInfo);
router.put(
  '/app-version',
  deployKeyOrAuth,
  validate(updateAppVersionInfoSchema),
  configuracionController.updateAppVersionInfo,
);

/**
 * @openapi
 * /configuraciones/marca:
 *   get:
 *     tags: [Configuraciones]
 *     summary: Obtener el nombre y logo configurados de la app
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Configuraciones]
 *     summary: Configurar el nombre y logo de la app. Solo Administrador.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Sin `auth`: el login y el sidebar necesitan poder mostrar la marca antes
// de que el usuario inicie sesión.
router.get('/marca', configuracionController.getMarcaApp);
router.put(
  '/marca',
  auth,
  requireAdmin,
  validate(updateMarcaAppSchema),
  configuracionController.updateMarcaApp,
);

export default router;
