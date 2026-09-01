import { Router } from 'express';
import { elaboracionController } from '../../controllers/inventario/elaboracion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createElaboracionSchema,
  getElaboracionSchema,
  listElaboracionSchema,
} from '../../validators/inventario/elaboracion.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(listElaboracionSchema), elaboracionController.list);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(getElaboracionSchema), elaboracionController.getByUuid);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_ELABORAR), validate(createElaboracionSchema), elaboracionController.create);

export default router;
