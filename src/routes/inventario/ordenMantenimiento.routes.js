import { Router } from 'express';
import { ordenMantenimientoController } from '../../controllers/inventario/ordenMantenimiento.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ordenChecklistController } from '../../controllers/inventario/ordenChecklist.controller.js';
import { ordenServicioController } from '../../controllers/inventario/ordenServicio.controller.js';
import { uploadAdjuntosMantenimiento } from '../../middlewares/upload.middleware.js';
import { guardarServicioSchema, adjuntosOrdenSchema, adjuntoUuidSchema, generarChecklistSchema, guardarChecklistSchema, crearHallazgoSchema, actualizarHallazgoSchema, hallazgoUuidSchema, programarHallazgoSchema } from '../../validators/inventario/checklist.validator.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { createOrdenSchema, updateOrdenSchema, getOrdenSchema, listOrdenSchema, cerrarOrdenSchema } from '../../validators/inventario/ordenMantenimiento.validator.js';

const router = Router();

// Checklist de la orden y hallazgos (con seguimiento aunque la orden ya esté cerrada).
router.get('/:uuid/checklist', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getOrdenSchema), ordenChecklistController.obtener);
router.post('/:uuid/checklist/generar', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(generarChecklistSchema), ordenChecklistController.generar);
router.put('/:uuid/checklist', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(guardarChecklistSchema), ordenChecklistController.guardar);
router.post('/:uuid/hallazgos', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(crearHallazgoSchema), ordenChecklistController.crearHallazgo);
router.put('/hallazgos/:hUuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(actualizarHallazgoSchema), ordenChecklistController.actualizarHallazgo);
router.delete('/hallazgos/:hUuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(hallazgoUuidSchema), ordenChecklistController.eliminarHallazgo);
router.post('/hallazgos/:hUuid/programar', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(programarHallazgoSchema), ordenChecklistController.programarHallazgo);

// Servicio externo (proveedor, técnico, participantes) y adjuntos (fotos, carta, informes en Google Drive).
router.get('/:uuid/servicio', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getOrdenSchema), ordenServicioController.obtener);
router.put('/:uuid/servicio', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(guardarServicioSchema), ordenServicioController.guardar);
router.post('/:uuid/adjuntos', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), uploadAdjuntosMantenimiento, validate(adjuntosOrdenSchema), ordenServicioController.agregarAdjuntos);
router.get('/adjuntos/:aUuid/archivo', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(adjuntoUuidSchema), ordenServicioController.descargarAdjunto);
router.delete('/adjuntos/:aUuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(adjuntoUuidSchema), ordenServicioController.eliminarAdjunto);

router.get('/', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(listOrdenSchema), ordenMantenimientoController.list);
router.post('/', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_CREAR), validate(createOrdenSchema), ordenMantenimientoController.create);
router.get('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_VER), validate(getOrdenSchema), ordenMantenimientoController.getByUuid);
router.put('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_EDITAR), validate(updateOrdenSchema), ordenMantenimientoController.update);
router.delete('/:uuid', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_ELIMINAR), validate(getOrdenSchema), ordenMantenimientoController.remove);
router.post('/:uuid/cerrar', auth, permission(PERMISSIONS.INVENTARIO_ORDENES_CERRAR), validate(cerrarOrdenSchema), ordenMantenimientoController.cerrar);

export default router;
