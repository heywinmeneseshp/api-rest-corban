import { Router } from 'express';
import { estadioSigatokaController } from '../../controllers/agricola/estadioSigatoka.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
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
// Sin permiso puntual para ver (igual que /fincas y /semanas): catálogo de
// referencia no sensible. Crear/editar/eliminar quedan reservados solo al
// rol Administrador (requireAdmin), no a un permiso asignable por rol.
router.get('/', auth, validate(listEstadiosSigatokaSchema), estadioSigatokaController.list);
router.post(
  '/',
  auth,
  requireAdmin,
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
router.get('/:uuid', auth, validate(getEstadioSigatokaSchema), estadioSigatokaController.getByUuid);
router.put(
  '/:uuid',
  auth,
  requireAdmin,
  validate(updateEstadioSigatokaSchema),
  estadioSigatokaController.update,
);
router.delete(
  '/:uuid',
  auth,
  requireAdmin,
  validate(getEstadioSigatokaSchema),
  estadioSigatokaController.remove,
);

export default router;
