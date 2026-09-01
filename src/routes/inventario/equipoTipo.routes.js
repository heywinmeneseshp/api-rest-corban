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

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER), validate(listEquipoTipoSchema), equipoTipoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_CREAR), validate(createEquipoTipoSchema), equipoTipoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER), validate(getEquipoTipoSchema), equipoTipoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(updateEquipoTipoSchema), equipoTipoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_ELIMINAR), validate(getEquipoTipoSchema), equipoTipoController.remove);

export default router;
