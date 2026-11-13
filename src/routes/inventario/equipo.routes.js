import { Router } from 'express';
import { equipoController } from '../../controllers/inventario/equipo.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createEquipoSchema,
  updateEquipoSchema,
  getEquipoSchema,
  listEquipoSchema,
  addComponenteSchema,
  removeComponenteSchema,
  registrarLecturaSchema,
  registrarLecturasLoteSchema,
  historialLecturasSchema,
} from '../../validators/inventario/equipo.validator.js';
import { hallazgosEquipoSchema } from '../../validators/inventario/checklist.validator.js';

const router = Router();

// Ver también lo permite quien trabaja con planes, programaciones u órdenes (eligen el equipo / plan en sus formularios).
router.get('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER, PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(listEquipoSchema), equipoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_CREAR), validate(createEquipoSchema), equipoController.create);
// Lecturas de kilometraje / horas (las registra quien opera el equipo). Van antes de '/:uuid' para que 'para-lecturas' y 'lecturas' no se tomen por un uuid.
const PUEDE_LEER_LECTURAS = [PERMISSIONS.INVENTARIO_EQUIPOS_LECTURAS, PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR, PERMISSIONS.INVENTARIO_EQUIPOS_VER];
const PUEDE_REGISTRAR_LECTURAS = [PERMISSIONS.INVENTARIO_EQUIPOS_LECTURAS, PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR];
router.get('/para-lecturas', auth, permission(...PUEDE_REGISTRAR_LECTURAS), equipoController.paraLecturas);
router.post('/lecturas/lote', auth, permission(...PUEDE_REGISTRAR_LECTURAS), validate(registrarLecturasLoteSchema), equipoController.registrarLecturasLote);
router.post('/:uuid/lecturas', auth, permission(...PUEDE_REGISTRAR_LECTURAS), validate(registrarLecturaSchema), equipoController.registrarLectura);
router.get('/:uuid/hallazgos', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(hallazgosEquipoSchema), equipoController.hallazgosPendientes);
router.get('/:uuid/lecturas', auth, permission(...PUEDE_LEER_LECTURAS), validate(historialLecturasSchema), equipoController.historialLecturas);

router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_VER, PERMISSIONS.INVENTARIO_PLANES_VER, PERMISSIONS.INVENTARIO_PROGRAMACIONES_VER, PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getEquipoSchema), equipoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(updateEquipoSchema), equipoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_ELIMINAR), validate(getEquipoSchema), equipoController.remove);

// Repuestos compatibles M2M
router.post('/:uuid/componentes', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(addComponenteSchema), equipoController.addComponente);
router.delete('/:uuid/componentes/:articuloUuid', auth, permission(PERMISSIONS.INVENTARIO_EQUIPOS_EDITAR), validate(removeComponenteSchema), equipoController.removeComponente);

export default router;
