import { Router } from 'express';
import { productoCategoriaController } from '../../controllers/inventario/productoCategoria.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createCategoriaSchema, updateCategoriaSchema, getCategoriaSchema, listCategoriaSchema } from '../../validators/inventario/productoCategoria.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_VER), validate(listCategoriaSchema), productoCategoriaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_CREAR), validate(createCategoriaSchema), productoCategoriaController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_VER), validate(getCategoriaSchema), productoCategoriaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_EDITAR), validate(updateCategoriaSchema), productoCategoriaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_ELIMINAR), validate(getCategoriaSchema), productoCategoriaController.remove);

export default router;
