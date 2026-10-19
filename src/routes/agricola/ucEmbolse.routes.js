import { Router } from 'express';
import { ucEmbolseController } from '../../controllers/agricola/ucEmbolse.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { opcionesUcEmbolseSchema, calcularUcEmbolseSchema } from '../../validators/agricola/ucEmbolse.validator.js';

const router = Router();

/**
 * @openapi
 * /reportes/uc-embolse/opciones:
 *   get:
 *     tags: [Reportes]
 *     summary: Fuentes de clima y bases de UC disponibles para UC por embolse
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 * /reportes/uc-embolse:
 *   get:
 *     tags: [Reportes]
 *     summary: UC acumuladas por edad (semanas desde el embolse) de cada semana de embolse
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/opciones', auth, permission(PERMISSIONS.MENU_REPORTES), validate(opcionesUcEmbolseSchema), ucEmbolseController.opciones);
router.get('/', auth, permission(PERMISSIONS.MENU_REPORTES), validate(calcularUcEmbolseSchema), ucEmbolseController.calcular);

export default router;
