import { Router } from 'express';
import { comprobanteAspersionController } from '../../controllers/agricola/comprobanteAspersion.controller.js';
import { auth } from '../../middlewares/auth.middleware.js';
import { permission } from '../../middlewares/permission.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.constants.js';
import { uploadKmlComprobante, uploadCorreoComprobante } from '../../middlewares/upload.middleware.js';
import {
  anularComprobanteAspersionSchema,
  reporteHectareasSchema,
  getComprobanteAspersionSchema,
  emitirComprobanteSchema,
  kmlComprobanteSchema,
  listComprobanteAspersionSchema,
  updateComprobanteAspersionSchema,
} from '../../validators/agricola/comprobanteAspersion.validator.js';

const router = Router();

router.get('/', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(listComprobanteAspersionSchema), comprobanteAspersionController.list);
// Pilotos de dron (cargo «Piloto de Dron») y asistentes para elegir al ejecutar o editar el comprobante.
router.get(
  '/participantes-disponibles',
  auth,
  permission(PERMISSIONS.SANIDAD_ASPERSIONES_EJECUTAR, PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR),
  comprobanteAspersionController.participantesDisponibles,
);
// Hectáreas asperjadas por colaborador, por día (Sanidad Vegetal → Colaboradores).
router.get(
  '/reporte-hectareas',
  auth,
  permission(PERMISSIONS.SV_COLABORADOR_VER, PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER),
  validate(reporteHectareasSchema),
  comprobanteAspersionController.reporteHectareas,
);
router.get('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(getComprobanteAspersionSchema), comprobanteAspersionController.getByUuid);
// PDF del comprobante generado en el servidor (para la app móvil; la web lo arma en el navegador, con los mapas).
router.get('/:uuid/pdf', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(getComprobanteAspersionSchema), comprobanteAspersionController.pdf);
router.put('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(updateComprobanteAspersionSchema), comprobanteAspersionController.update);
// Recorrido (KML) del borrador: subir, quitar y descargar el original.
router.put('/:uuid/kml', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(getComprobanteAspersionSchema), uploadKmlComprobante, comprobanteAspersionController.subirKml);
router.delete('/:uuid/kml', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.quitarKml);
router.get('/:uuid/kml', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(getComprobanteAspersionSchema), comprobanteAspersionController.descargarKml);
// Un recorrido puntual (el comprobante puede tener varios): descargarlo o quitarlo.
router.get('/:uuid/kml/:kmlUuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_VER), validate(kmlComprobanteSchema), comprobanteAspersionController.descargarKml);
router.delete('/:uuid/kml/:kmlUuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EDITAR), validate(kmlComprobanteSchema), comprobanteAspersionController.quitarKml);
// Enviar por correo el comprobante ya emitido (PDF con el mapa + KMZ del recorrido).
router.post('/:uuid/correo', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EMITIR), validate(getComprobanteAspersionSchema), uploadCorreoComprobante, comprobanteAspersionController.enviarCorreo);
router.post('/:uuid/emitir', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_EMITIR), validate(emitirComprobanteSchema), comprobanteAspersionController.emitir);
router.post('/:uuid/restaurar', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ELIMINAR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.restaurar);
router.delete('/:uuid', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ELIMINAR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.eliminar);
router.post('/:uuid/anular', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ANULAR), validate(anularComprobanteAspersionSchema), comprobanteAspersionController.anular);
router.post('/:uuid/regenerar', auth, permission(PERMISSIONS.SANIDAD_COMPROBANTES_ASPERSION_ANULAR), validate(getComprobanteAspersionSchema), comprobanteAspersionController.regenerar);

export default router;
