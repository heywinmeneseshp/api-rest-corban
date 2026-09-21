import { Router } from 'express';
import { estacionMeteorologicaController } from '../../controllers/agricola/estacionMeteorologica.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { historicoSchema, sincronizarSchema } from '../../validators/agricola/estacionMeteorologica.validator.js';

const router = Router();

router.get('/actual', auth, permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER), estacionMeteorologicaController.actual);
router.get(
  '/historico',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(historicoSchema),
  estacionMeteorologicaController.historico,
);
router.post(
  '/sincronizar',
  auth,
  permission(PERMISSIONS.ESTACION_METEOROLOGICA_VER),
  validate(sincronizarSchema),
  estacionMeteorologicaController.sincronizar,
);

export default router;
