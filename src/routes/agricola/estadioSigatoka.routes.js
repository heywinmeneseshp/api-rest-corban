import { Router } from 'express';
import { estadioSigatokaController } from '../../controllers/agricola/estadioSigatoka.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listEstadiosSigatokaSchema,
  getEstadioSigatokaSchema,
  createEstadioSigatokaSchema,
  updateEstadioSigatokaSchema,
} from '../../validators/agricola/estadioSigatoka.validator.js';

const router = Router();

/**
 * @openapi
 * /estadios-sigatoka:
 *   get:
 *     tags: [Estadios de Sigatoka]
 *     summary: Listar estadios de Sigatoka
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Estadios de Sigatoka]
 *     summary: Crear estadio de Sigatoka
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.ESTADIO_SIGATOKA_VER),
  validate(listEstadiosSigatokaSchema),
  estadioSigatokaController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.ESTADIO_SIGATOKA_CREAR),
  validate(createEstadioSigatokaSchema),
  estadioSigatokaController.create,
);

/**
 * @openapi
 * /estadios-sigatoka/{uuid}:
 *   get:
 *     tags: [Estadios de Sigatoka]
 *     summary: Obtener estadio de Sigatoka por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Estadios de Sigatoka]
 *     summary: Actualizar estadio de Sigatoka
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Estadios de Sigatoka]
 *     summary: Eliminar estadio de Sigatoka (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ESTADIO_SIGATOKA_VER),
  validate(getEstadioSigatokaSchema),
  estadioSigatokaController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ESTADIO_SIGATOKA_EDITAR),
  validate(updateEstadioSigatokaSchema),
  estadioSigatokaController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.ESTADIO_SIGATOKA_ELIMINAR),
  validate(getEstadioSigatokaSchema),
  estadioSigatokaController.remove,
);

export default router;
