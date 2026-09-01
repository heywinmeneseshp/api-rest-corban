import { Router } from 'express';
import { proformaController } from '../../controllers/inventario/proforma.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createProformaSchema,
  updateProformaSchema,
  getProformaSchema,
  listProformaSchema,
  convertirProformaSchema,
} from '../../validators/inventario/proforma.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_VER), validate(listProformaSchema), proformaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_CREAR), validate(createProformaSchema), proformaController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_VER), validate(getProformaSchema), proformaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_EDITAR), validate(updateProformaSchema), proformaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_ELIMINAR), validate(getProformaSchema), proformaController.remove);
router.post('/:uuid/convertir', auth, permission(PERMISSIONS.INVENTARIO_PROFORMAS_CONVERTIR), validate(convertirProformaSchema), proformaController.convertir);

export default router;
