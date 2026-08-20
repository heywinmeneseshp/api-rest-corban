import { Router } from 'express';
import { colaboradorController } from '../../controllers/agricola/colaborador.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listColaboradoresSchema,
  getColaboradorSchema,
  createColaboradorSchema,
  updateColaboradorSchema,
} from '../../validators/agricola/colaborador.validator.js';

const router = Router();

/**
 * @openapi
 * /colaboradores:
 *   get:
 *     tags: [Colaboradores]
 *     summary: Listar colaboradores (trabajadores de campo)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Colaboradores]
 *     summary: Crear colaborador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get('/', auth, permission(PERMISSIONS.COLABORADOR_VER), validate(listColaboradoresSchema), colaboradorController.list);
router.post('/', auth, permission(PERMISSIONS.COLABORADOR_CREAR), validate(createColaboradorSchema), colaboradorController.create);

/**
 * @openapi
 * /colaboradores/{uuid}:
 *   get:
 *     tags: [Colaboradores]
 *     summary: Obtener colaborador por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Colaboradores]
 *     summary: Actualizar colaborador
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Colaboradores]
 *     summary: Eliminar colaborador (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_VER), validate(getColaboradorSchema), colaboradorController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_EDITAR), validate(updateColaboradorSchema), colaboradorController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.COLABORADOR_ELIMINAR), validate(getColaboradorSchema), colaboradorController.remove);

export default router;
