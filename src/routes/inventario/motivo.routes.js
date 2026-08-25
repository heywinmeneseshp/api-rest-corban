import { Router } from 'express';
import { motivoController } from '../../controllers/inventario/motivo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createMotivoSchema, updateMotivoSchema, getMotivoSchema, listMotivoSchema } from '../../validators/inventario/motivo.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_VER), validate(listMotivoSchema), motivoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_CREAR), validate(createMotivoSchema), motivoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_VER), validate(getMotivoSchema), motivoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_EDITAR), validate(updateMotivoSchema), motivoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_ELIMINAR), validate(getMotivoSchema), motivoController.remove);

export default router;
