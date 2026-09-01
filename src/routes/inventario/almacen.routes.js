import { Router } from 'express';
import { almacenController } from '../../controllers/inventario/almacen.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createAlmacenSchema, updateAlmacenSchema, getAlmacenSchema, listAlmacenSchema } from '../../validators/inventario/almacen.validator.js';

const router = Router();

router.get('/tree', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_VER), almacenController.tree);
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_VER), validate(listAlmacenSchema), almacenController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_CREAR), validate(createAlmacenSchema), almacenController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_VER), validate(getAlmacenSchema), almacenController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_EDITAR), validate(updateAlmacenSchema), almacenController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ALMACENES_ELIMINAR), validate(getAlmacenSchema), almacenController.remove);

export default router;
