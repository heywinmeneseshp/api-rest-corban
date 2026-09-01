import { Router } from 'express';
import { articuloController } from '../../controllers/inventario/articulo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createArticuloSchema, updateArticuloSchema, getArticuloSchema, listArticuloSchema } from '../../validators/inventario/articulo.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER), validate(listArticuloSchema), articuloController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR), validate(createArticuloSchema), articuloController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER), validate(getArticuloSchema), articuloController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR), validate(updateArticuloSchema), articuloController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_ELIMINAR), validate(getArticuloSchema), articuloController.remove);

export default router;
