import { Router } from 'express';
import { planMantenimientoController } from '../../controllers/inventario/planMantenimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createPlanSchema, updatePlanSchema, getPlanSchema, listPlanSchema } from '../../validators/inventario/planMantenimiento.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_PLANES_VER), validate(listPlanSchema), planMantenimientoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PLANES_CREAR), validate(createPlanSchema), planMantenimientoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_VER), validate(getPlanSchema), planMantenimientoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_EDITAR), validate(updatePlanSchema), planMantenimientoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_ELIMINAR), validate(getPlanSchema), planMantenimientoController.remove);

export default router;
