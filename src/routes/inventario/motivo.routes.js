import { Router } from 'express';
import { motivoController } from '../../controllers/inventario/motivo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createMotivoSchema, updateMotivoSchema, getMotivoSchema, listMotivoSchema } from '../../validators/inventario/motivo.validator.js';

const router = Router();

// Lectura de catálogo de referencia: basta con tener sesión. Otros módulos (Mezclas, Aspersiones, Insumos, Usuarios, la app
// móvil y las demás pantallas de Inventarios/Equipos) usan estas listas en sus desplegables. Crear/editar/eliminar sí exige permiso.
router.get('/', auth, validate(listMotivoSchema), motivoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_CREAR), validate(createMotivoSchema), motivoController.create);
router.get('/:uuid', auth, validate(getMotivoSchema), motivoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_EDITAR), validate(updateMotivoSchema), motivoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MOTIVOS_ELIMINAR), validate(getMotivoSchema), motivoController.remove);

export default router;
