import { Router } from 'express';
import { ordenMantenimientoController } from '../../controllers/inventario/ordenMantenimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createOrdenSchema, updateOrdenSchema, getOrdenSchema, listOrdenSchema, cerrarOrdenSchema } from '../../validators/inventario/ordenMantenimiento.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(listOrdenSchema), ordenMantenimientoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_CREAR), validate(createOrdenSchema), ordenMantenimientoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getOrdenSchema), ordenMantenimientoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(updateOrdenSchema), ordenMantenimientoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_ELIMINAR), validate(getOrdenSchema), ordenMantenimientoController.remove);
router.post('/:uuid/cerrar', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_CERRAR), validate(cerrarOrdenSchema), ordenMantenimientoController.cerrar);

export default router;
