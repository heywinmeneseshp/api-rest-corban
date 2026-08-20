import { Router } from 'express';
import { productoController } from '../../controllers/agricola/producto.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listProductosSchema,
  getProductoSchema,
  createProductoSchema,
  updateProductoSchema,
  syncBanaricaProductosSchema,
} from '../../validators/agricola/producto.validator.js';

const router = Router();

/**
 * @openapi
 * /productos:
 *   get:
 *     tags: [Productos]
 *     summary: Listar productos
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Productos]
 *     summary: Crear producto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.PRODUCTO_VER), validate(listProductosSchema), productoController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.PRODUCTO_CREAR),
  validate(createProductoSchema),
  productoController.create,
);

/**
 * @openapi
 * /productos/banarica-combos:
 *   get:
 *     tags: [Productos]
 *     summary: Lista los combos activos de Logística (vista previa, no escribe nada)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/banarica-combos',
  auth,
  permission(PERMISSIONS.PRODUCTO_CREAR),
  productoController.previewBanarica,
);

/**
 * @openapi
 * /productos/sync-banarica:
 *   post:
 *     tags: [Productos]
 *     summary: Sincroniza los combos activos de Logística como productos
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/sync-banarica',
  auth,
  permission(PERMISSIONS.PRODUCTO_CREAR),
  validate(syncBanaricaProductosSchema),
  productoController.syncBanarica,
);

/**
 * @openapi
 * /productos/{uuid}:
 *   get:
 *     tags: [Productos]
 *     summary: Obtener producto por uuid
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Productos]
 *     summary: Actualizar producto
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Productos]
 *     summary: Eliminar producto (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid', auth, permission(PERMISSIONS.PRODUCTO_VER), validate(getProductoSchema), productoController.getByUuid);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PRODUCTO_EDITAR),
  validate(updateProductoSchema),
  productoController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.PRODUCTO_ELIMINAR),
  productoController.remove,
);

export default router;
