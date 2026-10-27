import { Router } from 'express';
import { equipoTipoController } from '../../controllers/inventario/equipoTipo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createEquipoTipoSchema, updateEquipoTipoSchema, getEquipoTipoSchema, listEquipoTipoSchema } from '../../validators/inventario/equipoTipo.validator.js';

// Catálogo chico, ligado 1:1 a Equipos (antes era un ENUM fijo en código) —
// reutiliza los permisos de Equipos en vez de sumar códigos nuevos.
const router = Router();

// Ver también lo permite quien trabaja con planes, programaciones u órdenes (eligen el equipo / plan en sus formularios).
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER, PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(listEquipoTipoSchema), equipoTipoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_CREAR), validate(createEquipoTipoSchema), equipoTipoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER, PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getEquipoTipoSchema), equipoTipoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(updateEquipoTipoSchema), equipoTipoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_ELIMINAR), validate(getEquipoTipoSchema), equipoTipoController.remove);

export default router;
