import { Router } from 'express';
import { zonaController } from '../../controllers/agricola/zona.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listZonasSchema,
  getZonaSchema,
  createZonaSchema,
  updateZonaSchema,
  assignFincaZonaSchema,
  removeFincaZonaSchema,
} from '../../validators/agricola/zona.validator.js';

const router = Router();

/**
 * @openapi
 * /zonas:
 *   get:
 *     tags: [Zonas]
 *     summary: Listar zonas
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Zonas]
 *     summary: Crear zona
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.ZONA_VER), validate(listZonasSchema), zonaController.list);
router.post('/', auth, permission(PERMISSIONS.ZONA_CREAR), validate(createZonaSchema), zonaController.create);

/**
 * @openapi
 * /zonas/{uuid}:
 *   get:
 *     tags: [Zonas]
 *     summary: Obtener zona por UUID (incluye sus fincas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Zonas]
 *     summary: Actualizar zona
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Zonas]
 *     summary: Eliminar zona (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid', auth, permission(PERMISSIONS.ZONA_VER), validate(getZonaSchema), zonaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.ZONA_EDITAR), validate(updateZonaSchema), zonaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.ZONA_ELIMINAR), validate(getZonaSchema), zonaController.remove);

/**
 * @openapi
 * /zonas/{uuid}/fincas:
 *   get:
 *     tags: [Zonas]
 *     summary: Listar fincas asignadas a la zona
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Zonas]
 *     summary: Asignar finca a la zona
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid/fincas',
  auth,
  permission(PERMISSIONS.ZONA_VER),
  validate(getZonaSchema),
  zonaController.listFincas,
);
router.post(
  '/:uuid/fincas',
  auth,
  permission(PERMISSIONS.ZONA_EDITAR),
  validate(assignFincaZonaSchema),
  zonaController.assignFinca,
);

/**
 * @openapi
 * /zonas/{uuid}/fincas/{fincaUuid}:
 *   delete:
 *     tags: [Zonas]
 *     summary: Remover finca de la zona
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:uuid/fincas/:fincaUuid',
  auth,
  permission(PERMISSIONS.ZONA_EDITAR),
  validate(removeFincaZonaSchema),
  zonaController.removeFinca,
);

export default router;
