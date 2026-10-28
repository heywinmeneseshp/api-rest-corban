import { Router } from 'express';
import { categoriaLaborController } from '../../controllers/agricola/categoriaLabor.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listCategoriasLaborSchema,
  getCategoriaLaborSchema,
  createCategoriaLaborSchema,
  updateCategoriaLaborSchema,
} from '../../validators/agricola/categoriaLabor.validator.js';

const router = Router();

/**
 * @openapi
 * /categorias-labor:
 *   get:
 *     tags: [Categorías de Labor]
 *     summary: Listar categorías de labor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Categorías de Labor]
 *     summary: Crear categoría de labor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
// Lectura de catálogo de referencia (lista y detalle): basta con tener sesión, como fincas y semanas. Otras pantallas (Registrar
// corte/repique, labores, estimaciones...) lo usan en sus desplegables. Crear, editar y eliminar sí exigen permiso.
router.get(
  '/',
  auth,
  validate(listCategoriasLaborSchema),
  categoriaLaborController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.CATEGORIA_LABOR_CREAR),
  validate(createCategoriaLaborSchema),
  categoriaLaborController.create,
);

/**
 * @openapi
 * /categorias-labor/{uuid}:
 *   get:
 *     tags: [Categorías de Labor]
 *     summary: Obtener categoría de labor por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Categorías de Labor]
 *     summary: Actualizar categoría de labor
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Categorías de Labor]
 *     summary: Eliminar categoría de labor (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  validate(getCategoriaLaborSchema),
  categoriaLaborController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CATEGORIA_LABOR_EDITAR),
  validate(updateCategoriaLaborSchema),
  categoriaLaborController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CATEGORIA_LABOR_ELIMINAR),
  validate(getCategoriaLaborSchema),
  categoriaLaborController.remove,
);

export default router;
