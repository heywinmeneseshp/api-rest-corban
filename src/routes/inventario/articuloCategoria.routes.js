import { Router } from 'express';
import { articuloCategoriaController } from '../../controllers/inventario/articuloCategoria.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createCategoriaSchema, updateCategoriaSchema, getCategoriaSchema, listCategoriaSchema } from '../../validators/inventario/articuloCategoria.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_VER), validate(listCategoriaSchema), articuloCategoriaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_CREAR), validate(createCategoriaSchema), articuloCategoriaController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_VER), validate(getCategoriaSchema), articuloCategoriaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_EDITAR), validate(updateCategoriaSchema), articuloCategoriaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_ELIMINAR), validate(getCategoriaSchema), articuloCategoriaController.remove);

export default router;
