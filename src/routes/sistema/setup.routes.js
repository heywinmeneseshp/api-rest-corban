import { Router } from 'express';
import { setupController } from '../../controllers/sistema/setup.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { setupEstadoSchema, setupSchema } from '../../validators/sistema/setup.validator.js';

const router = Router();

/**
 * @openapi
 * /sistema/setup/estado:
 *   get:
 *     tags: [Sistema]
 *     summary: Indica si falta completar la configuración inicial (crear el primer administrador). Sin autenticación — solo responde true si todavía no existe ningún usuario.
 *     responses:
 *       200: { description: OK }
 */
router.get('/setup/estado', validate(setupEstadoSchema), setupController.estado);

/**
 * @openapi
 * /sistema/setup:
 *   post:
 *     tags: [Sistema]
 *     summary: Crea el primer usuario administrador. Sin autenticación, pero solo funciona una vez — se rechaza si ya existe algún usuario.
 *     responses:
 *       201: { description: Creado }
 *       409: { description: La configuración inicial ya fue completada }
 */
router.post('/setup', validate(setupSchema), setupController.completar);

export default router;
