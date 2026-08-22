import { Router } from 'express';
import { fincaController } from '../../controllers/agricola/finca.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadBulkFile } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listFincasSchema,
  getFincaSchema,
  createFincaSchema,
  updateFincaSchema,
  listFincaLotesSchema,
  syncBanaricaSchema,
} from '../../validators/agricola/finca.validator.js';

const router = Router();

/**
 * @openapi
 * /fincas:
 *   get:
 *     tags: [Fincas]
 *     summary: Listar fincas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Fincas]
 *     summary: Crear finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
// Sin permiso puntual (igual que /semanas y /clima): fincas es dato de
// referencia no sensible (código/nombre) que casi todos los módulos
// necesitan para selectores y filtros — exigir finca.ver acá rompía
// pantallas enteras con Promise.all cuando el rol tenía el permiso de SU
// módulo pero no este.
router.get('/', auth, validate(listFincasSchema), fincaController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  validate(createFincaSchema),
  fincaController.create,
);

/**
 * @openapi
 * /fincas/banarica-almacenes:
 *   get:
 *     tags: [Fincas]
 *     summary: Lista los almacenes activos de api-rest-banarica (vista previa, no escribe nada)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/banarica-almacenes',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  fincaController.previewBanarica,
);

/**
 * @openapi
 * /fincas/{uuid}:
 *   get:
 *     tags: [Fincas]
 *     summary: Obtener finca por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Fincas]
 *     summary: Actualizar finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Fincas]
 *     summary: Eliminar finca (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_VER),
  validate(getFincaSchema),
  fincaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_EDITAR),
  validate(updateFincaSchema),
  fincaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.FINCA_ELIMINAR),
  validate(getFincaSchema),
  fincaController.remove,
);

/**
 * @openapi
 * /fincas/{uuid}/lotes:
 *   get:
 *     tags: [Fincas]
 *     summary: Listar lotes de una finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/lotes',
  auth,
  permission(PERMISSIONS.LOTE_VER),
  validate(listFincaLotesSchema),
  fincaController.listLotes,
);

/**
 * @openapi
 * /fincas/sync-banarica:
 *   post:
 *     tags: [Fincas]
 *     summary: Sincroniza los almacenes activos de api-rest-banarica como fincas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/sync-banarica',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  validate(syncBanaricaSchema),
  fincaController.syncBanarica,
);

/**
 * @openapi
 * /fincas/bulk-upload:
 *   post:
 *     tags: [Fincas]
 *     summary: Cargue masivo de fincas desde un archivo .csv/.xlsx
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/bulk-upload',
  auth,
  permission(PERMISSIONS.FINCA_CREAR),
  uploadBulkFile,
  fincaController.bulkUpload,
);

export default router;
