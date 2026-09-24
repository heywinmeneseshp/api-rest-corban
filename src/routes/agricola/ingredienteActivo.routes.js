import { Router } from 'express';
import { ingredienteActivoController } from '../../controllers/agricola/ingredienteActivo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listIngredientesActivosSchema,
  getIngredienteActivoSchema,
  createIngredienteActivoSchema,
  updateIngredienteActivoSchema,
} from '../../validators/agricola/ingredienteActivo.validator.js';

const router = Router();

/**
 * @openapi
 * /ingredientes-activos:
 *   get:
 *     tags: [Ingredientes Activos]
 *     summary: Listar ingredientes activos
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Ingredientes Activos]
 *     summary: Crear ingrediente activo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 */
router.get(
  '/',
  auth,
  permission(PERMISSIONS.INGREDIENTE_ACTIVO_VER),
  validate(listIngredientesActivosSchema),
  ingredienteActivoController.list,
);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.INGREDIENTE_ACTIVO_CREAR),
  validate(createIngredienteActivoSchema),
  ingredienteActivoController.create,
);

/**
 * @openapi
 * /ingredientes-activos/{uuid}:
 *   get:
 *     tags: [Ingredientes Activos]
 *     summary: Obtener ingrediente activo por UUID
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Ingredientes Activos]
 *     summary: Actualizar ingrediente activo
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Ingredientes Activos]
 *     summary: Eliminar ingrediente activo (soft delete)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INGREDIENTE_ACTIVO_VER),
  validate(getIngredienteActivoSchema),
  ingredienteActivoController.getByUuid,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INGREDIENTE_ACTIVO_EDITAR),
  validate(updateIngredienteActivoSchema),
  ingredienteActivoController.update,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.INGREDIENTE_ACTIVO_ELIMINAR),
  validate(getIngredienteActivoSchema),
  ingredienteActivoController.remove,
);

export default router;
