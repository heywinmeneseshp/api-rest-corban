import { Router } from 'express';
import { programacionMantenimientoController } from '../../controllers/inventario/programacionMantenimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createProgramacionSchema,
  updateProgramacionSchema,
  getProgramacionSchema,
  listProgramacionSchema,
} from '../../validators/inventario/programacionMantenimiento.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER), validate(listProgramacionSchema), programacionMantenimientoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PROGRAMACIONES_CREAR), validate(createProgramacionSchema), programacionMantenimientoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER), validate(getProgramacionSchema), programacionMantenimientoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROGRAMACIONES_EDITAR), validate(updateProgramacionSchema), programacionMantenimientoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROGRAMACIONES_ELIMINAR), validate(getProgramacionSchema), programacionMantenimientoController.remove);

export default router;
