import { Router } from 'express';
import { conteoController } from '../../controllers/inventario/conteo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listConteosSchema,
  getConteoSchema,
  createConteoSchema,
  guardarLineasConteoSchema,
  cerrarConteoSchema,
  anularConteoSchema,
} from '../../validators/inventario/conteo.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_VER), validate(listConteosSchema), conteoController.list);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_VER), validate(getConteoSchema), conteoController.getByUuid);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_CREAR), validate(createConteoSchema), conteoController.create);
router.put('/:uuid/lineas', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_CREAR), validate(guardarLineasConteoSchema), conteoController.guardarLineas);
router.post('/:uuid/cerrar', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_CERRAR), validate(cerrarConteoSchema), conteoController.cerrar);
router.post('/:uuid/anular', auth, permission(PERMISSIONS.INVENTARIO_CONTEOS_CREAR), validate(anularConteoSchema), conteoController.anular);

export default router;
