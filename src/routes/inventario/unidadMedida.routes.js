import { Router } from 'express';
import { unidadMedidaController } from '../../controllers/inventario/unidadMedida.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createUnidadSchema, updateUnidadSchema, getUnidadSchema, listUnidadSchema, createConversionSchema } from '../../validators/inventario/unidadMedida.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_VER), validate(listUnidadSchema, 'query'), unidadMedidaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_CREAR), validate(createUnidadSchema), unidadMedidaController.create);
router.get('/conversiones', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_VER), unidadMedidaController.listConversiones);
router.post('/conversiones', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_CREAR), validate(createConversionSchema), unidadMedidaController.createConversion);
router.delete('/conversiones/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_ELIMINAR), unidadMedidaController.deleteConversion);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_VER), validate(getUnidadSchema, 'params'), unidadMedidaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_EDITAR), validate(updateUnidadSchema), unidadMedidaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_ELIMINAR), validate(getUnidadSchema, 'params'), unidadMedidaController.remove);

export default router;
