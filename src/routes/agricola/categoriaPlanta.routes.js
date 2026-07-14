import { Router } from 'express';
import { categoriaPlantaController } from '../../controllers/agricola/categoriaPlanta.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listCategoriasSchema,
  getCategoriaSchema,
  createCategoriaSchema,
  updateCategoriaSchema,
} from '../../validators/agricola/categoriaPlanta.validator.js';

const router = Router();

/**
 * @openapi
 * /categorias-planta:
 *   get:
 *     tags: [Categorías de Planta]
 *     summary: Listar categorías de planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Categorías de Planta]
 *     summary: Crear categoría de planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.CATEGORIA_PLANTA_VER),
  validate(listCategoriasSchema),
  categoriaPlantaController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.CATEGORIA_PLANTA_CREAR),
  validate(createCategoriaSchema),
  categoriaPlantaController.create,
);

/**
 * @openapi
 * /categorias-planta/{uuid}:
 *   get:
 *     tags: [Categorías de Planta]
 *     summary: Obtener categoría de planta por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Categorías de Planta]
 *     summary: Actualizar categoría de planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Categorías de Planta]
 *     summary: Eliminar categoría de planta (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CATEGORIA_PLANTA_VER),
  validate(getCategoriaSchema),
  categoriaPlantaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CATEGORIA_PLANTA_EDITAR),
  validate(updateCategoriaSchema),
  categoriaPlantaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.CATEGORIA_PLANTA_ELIMINAR),
  validate(getCategoriaSchema),
  categoriaPlantaController.remove,
);

export default router;
