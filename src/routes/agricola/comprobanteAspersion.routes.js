import { Router } from 'express';
import { comprobanteAspersionController } from '../../controllers/agricola/comprobanteAspersion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  getComprobanteAspersionSchema,
  listComprobanteAspersionSchema,
  updateComprobanteAspersionSchema,
} from '../../validators/agricola/comprobanteAspersion.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(listComprobanteAspersionSchema), comprobanteAspersionController.list);
router.get('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(getComprobanteAspersionSchema), comprobanteAspersionController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(updateComprobanteAspersionSchema), comprobanteAspersionController.update);
router.post('/:uuid/emitir', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EMITIR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.emitir);
router.delete('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ELIMINAR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.remove);

export default router;
