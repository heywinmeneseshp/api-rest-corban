import { Router } from 'express';
import { loteAreaConfigController } from '../../controllers/agricola/loteAreaConfig.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listLoteAreaConfigSchema,
  createLoteAreaConfigSchema,
  toggleLoteAreaConfigSchema,
  removeLoteAreaConfigSchema,
  registrarAreaLoteSchema,
} from '../../validators/agricola/loteAreaConfig.validator.js';

const router = Router();

// pendientes/registrar: solo `auth`, sin permiso puntual — lo que importa es
// si el rol/finca del usuario calza con una config activa (igual criterio
// que /precipitacion-diaria/pendientes y /precipitacion-diaria).
router.get('/pendientes', auth, loteAreaConfigController.pendientes);
router.post('/registrar', auth, validate(registrarAreaLoteSchema), loteAreaConfigController.registrar);

router.get('/', auth, permission(PERMISSIONS.AREA_LOTE_VER), validate(listLoteAreaConfigSchema), loteAreaConfigController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(createLoteAreaConfigSchema),
  loteAreaConfigController.create,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(toggleLoteAreaConfigSchema),
  loteAreaConfigController.toggle,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(removeLoteAreaConfigSchema),
  loteAreaConfigController.remove,
);

export default router;
