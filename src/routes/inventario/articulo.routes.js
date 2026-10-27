import { Router } from 'express';
import { articuloController } from '../../controllers/inventario/articulo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createArticuloSchema, updateArticuloSchema, getArticuloSchema, listArticuloSchema } from '../../validators/inventario/articulo.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listArticuloSchema), articuloController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR), validate(createArticuloSchema), articuloController.create);
router.post('/bulk-upload', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR), uploadBulkFile, articuloController.bulkUpload);
router.get('/exportar', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER), articuloController.exportar);
// Papelera de artículos eliminados — solo Administrador (ver eliminados).
router.get('/eliminados', auth, requireAdmin, articuloController.listDeleted);
router.get('/:uuid', auth, validate(getArticuloSchema), articuloController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR), validate(updateArticuloSchema), articuloController.update);
// Eliminar — solo Administrador (antes bastaba el permiso granular).
router.delete('/:uuid', auth, requireAdmin, validate(getArticuloSchema), articuloController.remove);
router.post('/:uuid/restore', auth, requireAdmin, validate(getArticuloSchema), articuloController.restore);

export default router;
