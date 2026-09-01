import { Router } from 'express';
import { mezclaController } from '../../controllers/inventario/mezcla.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createMezclaSchema,
  updateMezclaSchema,
  getMezclaSchema,
  listMezclaSchema,
} from '../../validators/inventario/mezcla.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(listMezclaSchema), mezclaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR), validate(createMezclaSchema), mezclaController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(getMezclaSchema), mezclaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_EDITAR), validate(updateMezclaSchema), mezclaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_ELIMINAR), validate(getMezclaSchema), mezclaController.remove);

export default router;
