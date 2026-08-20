import { Router } from 'express';
import { rechazoCorteController } from '../../controllers/agricola/rechazoCorte.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireApiKey } from '../../middlewares/requireApiKey.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { webhookSyncRechazoSchema, resumenRechazoSchema } from '../../validators/agricola/rechazoCorte.validator.js';

const router = Router();

/**
 * @openapi
 * /rechazos-corte/webhook-sync-banarica:
 *   post:
 *     tags: [Rechazos]
 *     summary: Webhook llamado por api-rest-banarica cada vez que cambia un rechazo — requiere header `api` (CORBANA_API_KEY), no login.
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/webhook-sync-banarica',
  requireApiKey,
  validate(webhookSyncRechazoSchema),
  rechazoCorteController.webhookSync,
);

/**
 * @openapi
 * /rechazos-corte/resumen:
 *   get:
 *     tags: [Rechazos]
 *     summary: Total de cajas rechazadas por finca en una semana
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/resumen',
  auth,
  permission(PERMISSIONS.PROGRAMACION_CORTE_VER),
  validate(resumenRechazoSchema),
  rechazoCorteController.resumenPorSemana,
);

export default router;
