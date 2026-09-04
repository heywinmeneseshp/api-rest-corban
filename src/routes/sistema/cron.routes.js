import { Router } from 'express';
import { cronController } from '../../controllers/sistema/cron.controller.js';
import { requireCronSecret } from '../../middlewares/requireCronSecret.middleware.js';

const router = Router();

/**
 * @openapi
 * /cron/recalcular-produccion-semanal:
 *   get:
 *     tags: [Cron]
 *     summary: Recalcula Producción Semanal diariamente (Vercel Cron) — requiere Authorization Bearer CRON_SECRET.
 *     responses:
 *       200: { description: OK }
 */
router.get('/recalcular-produccion-semanal', requireCronSecret, cronController.recalcularProduccionSemanal);

/**
 * @openapi
 * /cron/enviar-alertas-sanidad-vegetal:
 *   get:
 *     tags: [Cron]
 *     summary: Envía el correo semanal de Alertas de Sanidad Vegetal al iniciar la semana (Vercel Cron) — requiere Authorization Bearer CRON_SECRET.
 *     responses:
 *       200: { description: OK }
 */
router.get('/enviar-alertas-sanidad-vegetal', requireCronSecret, cronController.enviarAlertasSanidadVegetal);

export default router;
