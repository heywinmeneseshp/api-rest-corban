import { Router } from 'express';
import { repuestoController } from '../../controllers/inventario/repuesto.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createArticuloSchema, updateArticuloSchema, getArticuloSchema, listArticuloSchema } from '../../validators/inventario/articulo.validator.js';

// Piezas y repuestos (menú Equipos): mismos permisos y validaciones que Artículos, con la categoría fija (ver repuesto.service.js).
const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER), validate(listArticuloSchema), repuestoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR), validate(createArticuloSchema), repuestoController.create);
router.get('/eliminados', auth, requireAdmin, repuestoController.listDeleted);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER), validate(getArticuloSchema), repuestoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR), validate(updateArticuloSchema), repuestoController.update);
router.delete('/:uuid', auth, requireAdmin, validate(getArticuloSchema), repuestoController.remove);
router.post('/:uuid/restore', auth, requireAdmin, validate(getArticuloSchema), repuestoController.restore);

export default router;
