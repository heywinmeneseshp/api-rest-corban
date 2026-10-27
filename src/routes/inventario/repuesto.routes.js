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

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listArticuloSchema), repuestoController.list);
// Crear/editar repuestos: con el permiso de Artículos o con el de Equipos (la pantalla vive en Equipos).
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR, PERMISSIONS.INVENTARIO_EQUIPOS_CREAR), validate(createArticuloSchema), repuestoController.create);
router.get('/eliminados', auth, requireAdmin, repuestoController.listDeleted);
router.get('/:uuid', auth, validate(getArticuloSchema), repuestoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR, PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(updateArticuloSchema), repuestoController.update);
router.delete('/:uuid', auth, requireAdmin, validate(getArticuloSchema), repuestoController.remove);
router.post('/:uuid/restore', auth, requireAdmin, validate(getArticuloSchema), repuestoController.restore);

export default router;
