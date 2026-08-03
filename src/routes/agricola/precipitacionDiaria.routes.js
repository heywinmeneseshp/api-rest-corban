import { Router } from 'express';
import { precipitacionDiariaController } from '../../controllers/agricola/precipitacionDiaria.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  crearConfigSchema,
  toggleConfigSchema,
  uuidParamSchema,
  registrarSchema,
} from '../../validators/agricola/precipitacionDiaria.validator.js';

const router = Router();

// Pendientes y registro: cualquier usuario autenticado (lo relevante es si
// su rol/finca coincide con una config activa, no un permiso aparte) — así
// el modal bloqueante funciona para cualquiera al que se le haya programado
// la tarea, sin tener que darle además un permiso explícito.
router.get('/pendientes', auth, precipitacionDiariaController.getPendientes);
router.post('/', auth, validate(registrarSchema), precipitacionDiariaController.registrar);

router.get('/', auth, permission(PERMISSIONS.PRECIPITACION_DIARIA_VER), precipitacionDiariaController.list);

router.get(
  '/config',
  auth,
  permission(PERMISSIONS.PRECIPITACION_DIARIA_VER),
  precipitacionDiariaController.listConfig,
);
router.post(
  '/config',
  auth,
  permission(PERMISSIONS.PRECIPITACION_DIARIA_CONFIGURAR),
  validate(crearConfigSchema),
  precipitacionDiariaController.crearConfig,
);
router.put(
  '/config/:uuid',
  auth,
  permission(PERMISSIONS.PRECIPITACION_DIARIA_CONFIGURAR),
  validate(toggleConfigSchema),
  precipitacionDiariaController.toggleConfig,
);
router.delete(
  '/config/:uuid',
  auth,
  permission(PERMISSIONS.PRECIPITACION_DIARIA_CONFIGURAR),
  validate(uuidParamSchema),
  precipitacionDiariaController.eliminarConfig,
);

export default router;
