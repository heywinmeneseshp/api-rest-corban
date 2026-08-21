import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/requireAdmin.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { laborCulturalController } from '../../controllers/agricola/laborCultural.controller.js';
import { uploadFotosLabor, uploadPdfLabor } from '../../middlewares/upload.middleware.js';
import {
  visitaUuidParamSchema,
  crearRolRevisorSchema,
  toggleRolRevisorSchema,
  uuidParamSchema,
  revisorCcSchema,
} from '../../validators/agricola/laborCultural.validator.js';

const router = Router();

// list/create: usados por la app móvil para registrar visitas, sin permiso
// dedicado (cualquier usuario autenticado puede enviar sus evaluaciones).
router.get('/', auth, laborCulturalController.list);
router.post('/', auth, laborCulturalController.create);
// Editar un lote de una propia visita ya enviada — el servicio valida que
// sea el mismo usuario que la creó y que todavía no esté revisada.
router.put('/visitas/:visitaUuid/lotes/:loteUuid', auth, laborCulturalController.updateLote);
// Fotos de la visita (Google Drive) — mismo criterio sin permiso dedicado,
// las sube el mismo evaluador que ya registró la visita.
router.post('/visitas/:visitaUuid/fotos', auth, uploadFotosLabor, laborCulturalController.agregarFotos);
// visitas/*: reporte de consulta en app-corbana (Sanidad Vegetal › Evaluación
// de Labores), requiere permiso propio para poder asignarlo por rol — salvo
// que el usuario esté consultando/viendo SU PROPIA visita (historial en la
// app móvil, ver labores-culturales/lista.tsx y [visitaUuid].tsx allá), que
// no exige ningún permiso (el control real de acceso al detalle, que
// depende de haberla creado, se valida en el controlador con los datos ya
// consultados).
router.get('/visitas', auth, laborCulturalController.listVisitas);
router.get('/visitas/:visitaUuid', auth, laborCulturalController.getVisita);
// Contenido de una foto (streameado desde Drive) — mismo criterio de acceso
// que getVisita, validado en el controlador contra la visita dueña de la
// foto.
router.get('/fotos/:fotoUuid/archivo', auth, laborCulturalController.obtenerFoto);
// Eliminar una visita: acción reservada solo al rol Administrador (no hay
// permiso granular propio; borrar registros de evaluaciones es de alto
// impacto y no se le asigna a roles operativos).
router.delete('/visitas/:visitaUuid', auth, requireAdmin, laborCulturalController.deleteVisita);

// Marcar una visita como revisada: cualquier autenticado puede intentarlo,
// el propio servicio valida si su rol está en la config activa (o es
// Administrador) — mismo criterio que precipitacion_diaria (config por rol,
// sin permiso granular dedicado).
router.put(
  '/visitas/:visitaUuid/revisar',
  auth,
  validate(visitaUuidParamSchema),
  laborCulturalController.marcarRevisada,
);

// Configuración de qué rol(es) pueden revisar: reservada al Administrador,
// igual que eliminar visitas.
router.get('/revisor-config', auth, requireAdmin, laborCulturalController.listRolesRevisores);
router.post(
  '/revisor-config',
  auth,
  requireAdmin,
  validate(crearRolRevisorSchema),
  laborCulturalController.crearRolRevisor,
);
router.put(
  '/revisor-config/:uuid',
  auth,
  requireAdmin,
  validate(toggleRolRevisorSchema),
  laborCulturalController.toggleRolRevisor,
);
router.delete(
  '/revisor-config/:uuid',
  auth,
  requireAdmin,
  validate(uuidParamSchema),
  laborCulturalController.eliminarRolRevisor,
);

// Correos en copia (CC) para los avisos de cargue/revisión — reservado al
// Administrador, igual que el resto de la configuración del revisor.
router.get('/revisor-cc', auth, requireAdmin, laborCulturalController.getRevisorCc);
router.put(
  '/revisor-cc',
  auth,
  requireAdmin,
  validate(revisorCcSchema),
  laborCulturalController.setRevisorCc,
);

// Aviso de revisión aprobada con el PDF adjunto (generado en el navegador)
// — mismo criterio sin permiso dedicado que marcar como revisada.
router.post(
  '/visitas/:visitaUuid/correo-revision',
  auth,
  uploadPdfLabor,
  validate(visitaUuidParamSchema),
  laborCulturalController.enviarCorreoRevision,
);

export default router;
