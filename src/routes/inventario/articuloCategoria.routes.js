import { Router } from 'express';
import { articuloCategoriaController } from '../../controllers/inventario/articuloCategoria.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createCategoriaSchema, updateCategoriaSchema, getCategoriaSchema, listCategoriaSchema } from '../../validators/inventario/articuloCategoria.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listCategoriaSchema), articuloCategoriaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_CREAR), validate(createCategoriaSchema), articuloCategoriaController.create);
router.get('/:uuid', auth, validate(getCategoriaSchema), articuloCategoriaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_EDITAR), validate(updateCategoriaSchema), articuloCategoriaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CATEGORIAS_ELIMINAR), validate(getCategoriaSchema), articuloCategoriaController.remove);

export default router;
