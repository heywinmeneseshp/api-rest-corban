import { Router } from 'express';
import { loteAreaConfigController } from '../../controllers/agricola/loteAreaConfig.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  listLoteAreaConfigSchema,
  createLoteAreaConfigSchema,
  toggleLoteAreaConfigSchema,
  removeLoteAreaConfigSchema,
  registrarAreaLoteSchema,
  removeLotePendienteSchema,
  createLotePendienteSchema,
  listSolicitudesSchema,
  resolverSolicitudSchema,
} from '../../validators/agricola/loteAreaConfig.validator.js';

const router = Router();

// pendientes/registrar: solo `auth`, sin permiso puntual — lo que importa es
// si el rol/finca del usuario calza con una config activa (igual criterio
// que /precipitacion-diaria/pendientes y /precipitacion-diaria).
// Agregar/ocultar lotes del pendiente SÍ piden permiso puntual configurable
// por rol (area_lote.gestionar_lotes, asignable en Maestros > Roles);
// además el servicio verifica el alcance. Ocultar no borra nada (sin
// protecciones por registros asociados) y es por campaña: en una campaña
// nueva el lote vuelve a aparecer.
router.get('/pendientes', auth, loteAreaConfigController.pendientes);
router.post('/registrar', auth, validate(registrarAreaLoteSchema), loteAreaConfigController.registrar);
router.post(
  '/pendientes/lotes',
  auth,
  permission(PERMISSIONS.AREA_LOTE_GESTIONAR_LOTES),
  validate(createLotePendienteSchema),
  loteAreaConfigController.agregarLotePendiente,
);
router.delete(
  '/pendientes/:loteUuid',
  auth,
  permission(PERMISSIONS.AREA_LOTE_GESTIONAR_LOTES),
  validate(removeLotePendienteSchema),
  loteAreaConfigController.eliminarLotePendiente,
);

// Aprobación de los cambios de área enviados desde el modal.
router.get(
  '/solicitudes',
  auth,
  permission(PERMISSIONS.AREA_LOTE_APROBAR),
  validate(listSolicitudesSchema),
  loteAreaConfigController.solicitudes,
);
router.post(
  '/solicitudes/:uuid/aprobar',
  auth,
  permission(PERMISSIONS.AREA_LOTE_APROBAR),
  validate(resolverSolicitudSchema),
  loteAreaConfigController.aprobarSolicitud,
);
router.post(
  '/solicitudes/:uuid/rechazar',
  auth,
  permission(PERMISSIONS.AREA_LOTE_APROBAR),
  validate(resolverSolicitudSchema),
  loteAreaConfigController.rechazarSolicitud,
);

router.get('/', auth, permission(PERMISSIONS.AREA_LOTE_VER), validate(listLoteAreaConfigSchema), loteAreaConfigController.list);
router.post(
  '/',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(createLoteAreaConfigSchema),
  loteAreaConfigController.create,
);
router.put(
  '/:uuid',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(toggleLoteAreaConfigSchema),
  loteAreaConfigController.toggle,
);
router.delete(
  '/:uuid',
  auth,
  permission(PERMISSIONS.AREA_LOTE_CONFIGURAR),
  validate(removeLoteAreaConfigSchema),
  loteAreaConfigController.remove,
);

export default router;
