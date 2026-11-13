import { Router } from 'express';
import { checklistPlantillaController } from '../../controllers/inventario/checklistPlantilla.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { crearPlantillaSchema, actualizarPlantillaSchema, plantillaUuidSchema } from '../../validators/inventario/checklist.validator.js';

const router = Router();

// Plantillas de checklist de mantenimiento: se gestionan con los permisos de Planes; verlas también lo permite quien trabaja con órdenes.
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), checklistPlantillaController.list);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(plantillaUuidSchema), checklistPlantillaController.getByUuid);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_PLANES_CREAR), validate(crearPlantillaSchema), checklistPlantillaController.create);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_EDITAR), validate(actualizarPlantillaSchema), checklistPlantillaController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_PLANES_ELIMINAR), validate(plantillaUuidSchema), checklistPlantillaController.remove);

export default router;
