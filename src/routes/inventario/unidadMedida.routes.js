import { Router } from 'express';
import { unidadMedidaController } from '../../controllers/inventario/unidadMedida.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createUnidadSchema, updateUnidadSchema, getUnidadSchema, listUnidadSchema, createConversionSchema, getConversionSchema } from '../../validators/inventario/unidadMedida.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listUnidadSchema), unidadMedidaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_CREAR), validate(createUnidadSchema), unidadMedidaController.create);
router.get('/conversiones', auth, unidadMedidaController.listConversiones);
router.post('/conversiones', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_CREAR), validate(createConversionSchema), unidadMedidaController.createConversion);
router.delete('/conversiones/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_ELIMINAR), validate(getConversionSchema), unidadMedidaController.deleteConversion);
router.get('/:uuid', auth, validate(getUnidadSchema), unidadMedidaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_EDITAR), validate(updateUnidadSchema), unidadMedidaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_UNIDADES_ELIMINAR), validate(getUnidadSchema), unidadMedidaController.remove);

export default router;
