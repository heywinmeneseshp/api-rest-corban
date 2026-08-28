import { Router } from 'express';
import { facturaController } from '../../controllers/inventario/factura.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { getFacturaSchema, listFacturaSchema } from '../../validators/inventario/factura.validator.js';

const router = Router();

// Solo lectura — se crean únicamente al convertir una proforma
// (POST /proformas/:uuid/convertir).
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_FACTURAS_VER), validate(listFacturaSchema), facturaController.list);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_FACTURAS_VER), validate(getFacturaSchema), facturaController.getByUuid);

export default router;
