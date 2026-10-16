import { Router } from 'express';
import { emisionFoliarController } from '../../controllers/agricola/emisionFoliar.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  getEmisionSchema,
  createEmisionSchema,
  updateEmisionSchema,
  seguimientoEmisionSchema,
} from '../../validators/agricola/emisionFoliar.validator.js';

const router = Router();

/**
 * @openapi
 * /evaluaciones/emision-foliar/seguimiento:
 *   get:
 *     tags: [Emisión Foliar]
 *     summary: Seguimiento semanal de hojas totales y candela, por planta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 * /evaluaciones/{uuid}/emision-foliar:
 *   get:
 *     tags: [Emisión Foliar]
 *     summary: Obtener la emisión foliar de una evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Emisión Foliar]
 *     summary: Registrar emisión foliar (hojas totales y candela)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Creado }
 *   put:
 *     tags: [Emisión Foliar]
 *     summary: Actualizar emisión foliar de una evaluación
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
// Esta ruta literal va ANTES de '/:uuid/...' para que no la capture el param.
router.get(
  '/emision-foliar/seguimiento',
  auth,
  permission(PERMISSIONS.EVALUACION_VER),
  validate(seguimientoEmisionSchema),
  emisionFoliarController.seguimiento,
);
router.get('/:uuid/emision-foliar', auth, permission(PERMISSIONS.EVALUACION_VER), validate(getEmisionSchema), emisionFoliarController.getByEvaluacion);
router.post('/:uuid/emision-foliar', auth, permission(PERMISSIONS.EVALUACION_CREAR), validate(createEmisionSchema), emisionFoliarController.create);
router.put('/:uuid/emision-foliar', auth, permission(PERMISSIONS.EVALUACION_EDITAR), validate(updateEmisionSchema), emisionFoliarController.update);

export default router;
