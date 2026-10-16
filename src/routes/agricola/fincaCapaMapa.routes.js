import { Router } from 'express';
import { fincaCapaMapaController } from '../../controllers/agricola/fincaCapaMapa.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { listCapasSchema, reemplazarCapasSchema, borrarCapasSchema } from '../../validators/agricola/fincaCapaMapa.validator.js';

const router = Router();

/**
 * @openapi
 * /fincas/{uuid}/capas-mapa:
 *   get:
 *     tags: [Fincas]
 *     summary: Capas de mapa de la finca (vías de cable, canales, parcelas, riego…)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [Fincas]
 *     summary: Reemplazar una categoría de capas de la finca (atómico, importado de KMZ)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Fincas]
 *     summary: Eliminar una categoría de capas de la finca
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/:uuid/capas-mapa', auth, permission(PERMISSIONS.FINCA_VER), validate(listCapasSchema), fincaCapaMapaController.list);
router.put('/:uuid/capas-mapa', auth, permission(PERMISSIONS.FINCA_EDITAR), validate(reemplazarCapasSchema), fincaCapaMapaController.reemplazar);
router.delete('/:uuid/capas-mapa', auth, permission(PERMISSIONS.FINCA_EDITAR), validate(borrarCapasSchema), fincaCapaMapaController.borrar);

export default router;
