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

export default router;
