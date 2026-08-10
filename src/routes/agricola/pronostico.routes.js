import { Router } from 'express';
import { pronosticoController } from '../../controllers/agricola/pronostico.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { getPronosticoSchema, exportarPronosticoSchema } from '../../validators/agricola/pronostico.validator.js';

const router = Router();

/**
 * @openapi
 * /pronostico:
 *   get:
 *     tags: [Pronóstico]
 *     summary: Pronóstico de cajas por finca y semana (racimos → ratio → cajas 20kg)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/', auth, permission(PERMISSIONS.PRONOSTICO_VER), validate(getPronosticoSchema), pronosticoController.get);

/**
 * @openapi
 * /pronostico/exportar:
 *   get:
 *     tags: [Pronóstico]
 *     summary: Exportar el pronóstico de cajas a Excel con los filtros actuales
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Archivo Excel }
 */
router.get(
  '/exportar',
  auth,
  permission(PERMISSIONS.PRONOSTICO_VER),
  validate(exportarPronosticoSchema),
  pronosticoController.exportar,
);

export default router;
