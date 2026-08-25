import { Router } from 'express';
import { movimientoController } from '../../controllers/inventario/movimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createMovimientoSchema, createTransferenciaSchema, listMovimientoSchema, getMovimientoSchema, kardexSchema } from '../../validators/inventario/movimiento.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(listMovimientoSchema, 'query'), movimientoController.list);
router.get('/existencias', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), movimientoController.existencias);
router.get('/kardex', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(kardexSchema, 'query'), movimientoController.kardex);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(getMovimientoSchema, 'params'), movimientoController.getByUuid);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR), validate(createMovimientoSchema), movimientoController.create);
router.post('/transferencias', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR), validate(createTransferenciaSchema), movimientoController.createTransferencia);

export default router;
