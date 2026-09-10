import { Router } from 'express';
import { mezclaController } from '../../controllers/inventario/mezcla.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadFotosLabor } from '../../middlewares/upload.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import {
  createMezclaSchema,
  updateMezclaSchema,
  getMezclaSchema,
  listMezclaSchema,
  getVersionSchema,
  setComponentesSchema,
  agregarEtapaSchema,
  finalizarVersionSchema,
  crearElaboradoSchema,
  eliminarFotoSchema,
  eliminarEtapaSchema,
  mezclaParametrosSchema,
  listHistorialSchema,
} from '../../validators/inventario/mezcla.validator.js';

const router = Router();

// Parámetros de validación (pH/CE) — antes de /:uuid para no chocar con el
// parseo de uuid. GET: cualquiera con acceso al módulo (el formulario los
// necesita para mostrar el rango); PUT: solo Administrador.
router.get('/parametros', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), mezclaController.getParametros);
router.put('/parametros', auth, requireAdmin, validate(mezclaParametrosSchema), mezclaController.setParametros);

// Foto — fuera del namespace /:uuid/versiones porque se referencia solo
// por su propio uuid (igual que labor_visita_fotos).
router.get('/fotos/:fotoUuid/archivo', auth, mezclaController.obtenerFoto);
router.delete('/fotos/:fotoUuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_EDITAR), validate(eliminarFotoSchema), mezclaController.eliminarFoto);

// Etapa — mismo criterio: se referencia solo por su propio uuid, fuera del
// namespace /:uuid/versiones. Solo se puede borrar mientras la prueba sigue
// editable (BORRADOR/EN_PRUEBA) — ver mezcla.service.js#eliminarEtapa.
router.delete('/etapas/:etapaUuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_EDITAR), validate(eliminarEtapaSchema), mezclaController.eliminarEtapa);

// Historial de pruebas — antes de /:uuid para no chocar con el parseo de uuid.
router.get('/historial', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(listHistorialSchema), mezclaController.listHistorial);

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(listMezclaSchema), mezclaController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR), validate(createMezclaSchema), mezclaController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER), validate(getMezclaSchema), mezclaController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_MEZCLAS_EDITAR), validate(updateMezclaSchema), mezclaController.update);
// Eliminar una prueba de mezcla queda reservado solo al rol Administrador
// (pedido explícito) — a diferencia del resto del CRUD, que sigue usando el
// permiso granular inventario.mezclas.eliminar asignable por rol.
router.delete('/:uuid', auth, requireAdmin, validate(getMezclaSchema), mezclaController.remove);

// ─── Prueba de laboratorio (MezclaVersion) ───

router.get(
  '/:uuid/versiones/:versionUuid',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_VER),
  validate(getVersionSchema),
  mezclaController.getVersion,
);
router.put(
  '/:uuid/versiones/:versionUuid/componentes',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR),
  validate(setComponentesSchema),
  mezclaController.setComponentes,
);
router.post(
  '/:uuid/versiones/:versionUuid/etapas',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR),
  validate(agregarEtapaSchema),
  mezclaController.agregarEtapa,
);
router.post(
  '/:uuid/versiones/:versionUuid/fotos',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR),
  uploadFotosLabor,
  mezclaController.subirFotos,
);
router.post(
  '/:uuid/versiones/:versionUuid/finalizar',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_CREAR),
  validate(finalizarVersionSchema),
  mezclaController.finalizar,
);
router.post(
  '/:uuid/versiones/:versionUuid/crear-elaborado',
  auth,
  permission(PERMISSIONS.INVENTARIO_MEZCLAS_ELABORAR),
  validate(crearElaboradoSchema),
  mezclaController.crearElaborado,
);

export default router;
