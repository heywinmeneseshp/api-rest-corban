import { Router } from 'express';
import { productoInventarioController } from '../../controllers/inventario/productoInventario.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createProductoInventarioSchema, updateProductoInventarioSchema, getProductoSchema, listProductoSchema } from '../../validators/inventario/producto.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_PRODUCTOS_VER), validate(listProductoSchema, 'query'), productoInventarioController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PRODUCTOS_CREAR), validate(createProductoInventarioSchema), productoInventarioController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PRODUCTOS_VER), validate(getProductoSchema, 'params'), productoInventarioController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PRODUCTOS_EDITAR), validate(updateProductoInventarioSchema), productoInventarioController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PRODUCTOS_ELIMINAR), validate(getProductoSchema, 'params'), productoInventarioController.remove);

export default router;
