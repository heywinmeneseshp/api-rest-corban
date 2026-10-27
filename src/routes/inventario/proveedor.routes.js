import { Router } from 'express';
import { proveedorController } from '../../controllers/inventario/proveedor.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createProveedorSchema, updateProveedorSchema, getProveedorSchema, listProveedorSchema } from '../../validators/inventario/proveedor.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listProveedorSchema), proveedorController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PROVEEDORES_CREAR), validate(createProveedorSchema), proveedorController.create);
router.get('/:uuid', auth, validate(getProveedorSchema), proveedorController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROVEEDORES_EDITAR), validate(updateProveedorSchema), proveedorController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROVEEDORES_ELIMINAR), validate(getProveedorSchema), proveedorController.remove);

export default router;
