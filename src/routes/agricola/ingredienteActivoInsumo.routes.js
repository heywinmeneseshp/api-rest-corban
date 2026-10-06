import { Router } from 'express';
import { ingredienteActivoInsumoController } from '../../controllers/agricola/ingredienteActivoInsumo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listInsumosSchema,
  getInsumoSchema,
  createInsumoSchema,
  updateInsumoSchema,
} from '../../validators/agricola/ingredienteActivoInsumo.validator.js';

// Insumos (Sanidad Vegetal) — mismo recurso Articulo que Inventarios, solo
// que acá siempre quedan en la categoría fija "Sanidad Vegetal" (ver
// ingredienteActivoInsumo.service.js) y no se elige categoría en el
// formulario. Reutiliza los permisos de acción de inventario.articulos.*
// (es el mismo recurso, no duplica reglas de negocio de permisos).
const router = Router();

router.get(
  '/',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER),
  validate(listInsumosSchema),
  ingredienteActivoInsumoController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR),
  validate(createInsumoSchema),
  ingredienteActivoInsumoController.create,
);
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_CREAR),
  uploadBulkFile,
  ingredienteActivoInsumoController.bulkUpload,
);
// Papelera de insumos eliminados — solo Administrador (ver eliminados).
// Antes de /:uuid por el mismo motivo que /bulk-upload arriba.
router.get('/eliminados', auth, requireAdmin, ingredienteActivoInsumoController.listDeleted);
router.post('/:uuid/restore', auth, requireAdmin, validate(getInsumoSchema), ingredienteActivoInsumoController.restore);
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_VER),
  validate(getInsumoSchema),
  ingredienteActivoInsumoController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_EDITAR),
  validate(updateInsumoSchema),
  ingredienteActivoInsumoController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INVENTARIO_ARTICULOS_ELIMINAR),
  validate(getInsumoSchema),
  ingredienteActivoInsumoController.remove,
);

export default router;
