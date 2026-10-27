import { Router } from 'express';
import { movimientoController } from '../../controllers/inventario/movimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createTransferenciaSchema, createLoteSchema, listMovimientoSchema, getMovimientoSchema, existenciasSchema, kardexSchema } from '../../validators/inventario/movimiento.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(listMovimientoSchema), movimientoController.list);
router.get('/existencias', auth, validate(existenciasSchema), movimientoController.existencias);
router.get('/kardex', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(kardexSchema), movimientoController.kardex);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_VER), validate(getMovimientoSchema), movimientoController.getByUuid);
router.post('/lote', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR), validate(createLoteSchema), movimientoController.createLote);
router.post('/transferencias', auth, permission(PERMISSIONS.INVENTARIO_MOVIMIENTOS_CREAR), validate(createTransferenciaSchema), movimientoController.createTransferencia);

export default router;
